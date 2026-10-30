import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
/** Detect corruption and local tampering; not a signature against a privileged administrator. */
export function verifyIntegrity(db: DatabaseSync) {
  if (
    db.prepare("PRAGMA quick_check").get()?.quick_check !== "ok" ||
    db.prepare("PRAGMA foreign_key_check").all().length
  )
    throw Error("Database integrity check failed; restore a verified backup");
  let previous = "genesis";
  const records = new Map<string, string>();
  for (const row of db
    .prepare("SELECT * FROM audit ORDER BY seq")
    .all() as any[]) {
    const expected = createHash("sha256")
      .update(
        JSON.stringify([row.at, row.actor, row.action, row.detail, previous]),
      )
      .digest("hex");
    if (row.previous_hash !== previous || row.hash !== expected)
      throw Error("Audit integrity check failed; restore a verified backup");
    previous = row.hash;
    let d;
    try {
      d = JSON.parse(row.detail);
    } catch {
      throw Error("Audit data is invalid");
    }
    if (d?.id && d?.kind && d?.createdAt && d?.pid)
      records.set(d.id, JSON.stringify(d));
  }
  for (const r of db
    .prepare("SELECT * FROM records ORDER BY seq")
    .all() as any[]) {
    let data;
    try {
      data = JSON.parse(r.data);
    } catch {
      throw Error("Record data is invalid");
    }
    const canonical = JSON.stringify({
      id: r.id,
      pid: r.pid,
      kind: r.kind,
      author: r.author,
      createdAt: r.created_at,
      data,
    });
    if (records.get(r.id) !== canonical)
      throw Error(
        "Record audit integrity check failed; restore a verified backup",
      );
  }
}
