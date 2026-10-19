import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { schemaVersion } from "../server/migrations.ts";
export function verifyDatabase(path: string) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    if (
      db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok" ||
      db.prepare("PRAGMA foreign_key_check").all().length
    )
      throw Error("Database integrity check failed");
    const versions = db
      .prepare("SELECT version FROM migrations ORDER BY version")
      .all()
      .map((r) => Number(r.version));
    if (
      versions.length !== schemaVersion ||
      versions.some((v, i) => v !== i + 1)
    )
      throw Error("Unsupported schema for this application");
    let previous = "genesis";
    for (const r of db.prepare("SELECT * FROM audit ORDER BY seq").all()) {
      const hash = createHash("sha256")
        .update(JSON.stringify([r.at, r.actor, r.action, r.detail, previous]))
        .digest("hex");
      if (r.previous_hash !== previous || r.hash !== hash)
        throw Error("Audit chain integrity failed");
      previous = hash;
    }
    for (const table of ["evidence", "document_files"])
      for (const r of db.prepare(`SELECT bytes,sha256 FROM ${table}`).all())
        if (
          createHash("sha256")
            .update(r.bytes as Uint8Array)
            .digest("hex") !== r.sha256
        )
          throw Error("Attachment integrity failed");
    return true;
  } finally {
    db.close();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  if (!process.argv[2]) throw Error("Provide a database path");
  verifyDatabase(process.argv[2]);
  console.log("Database, references, audit chain and attachments verified");
}
