import { DatabaseSync } from "node:sqlite";
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  scryptSync,
  randomBytes,
} from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  lstatSync,
  existsSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { backupDatabase } from "./backup.ts";
import { schemaVersion } from "../server/migrations.ts";
const magic = Buffer.from("JRBACKUP1"),
  maxSize = 256 * 1024 * 1024;
export function verifyStagingBackup(path: string) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    if (
      db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok" ||
      db.prepare("PRAGMA foreign_key_check").all().length
    )
      throw Error("Backup database integrity failed");
    const versions = db
      .prepare("SELECT version FROM migrations ORDER BY version")
      .all()
      .map((r) => Number(r.version));
    if (
      versions.length !== schemaVersion ||
      versions.some((v, i) => v !== i + 1)
    )
      throw Error("Backup schema does not match this release");
    let previous = "genesis";
    const audited = new Map<string, string>();
    for (const row of db
      .prepare("SELECT * FROM audit ORDER BY seq")
      .all() as any[]) {
      const hash = createHash("sha256")
        .update(
          JSON.stringify([row.at, row.actor, row.action, row.detail, previous]),
        )
        .digest("hex");
      if (row.previous_hash !== previous || row.hash !== hash)
        throw Error("Backup audit chain failed");
      previous = hash;
      const d = JSON.parse(row.detail);
      if (d.id) audited.set(d.id, row.detail);
    }
    for (const row of db
      .prepare("SELECT * FROM records ORDER BY seq")
      .all() as any[]) {
      const record = {
        id: row.id,
        pid: row.pid,
        kind: row.kind,
        author: row.author,
        createdAt: row.created_at,
        data: JSON.parse(row.data),
      };
      if (audited.get(row.id) !== JSON.stringify(record))
        throw Error("Backup record/audit mismatch");
    }
    for (const row of db
      .prepare("SELECT bytes,sha256 FROM evidence")
      .all() as any[])
      if (
        createHash("sha256").update(Buffer.from(row.bytes)).digest("hex") !==
        row.sha256
      )
        throw Error("Backup evidence hash failed");
    const projects = db.prepare("SELECT id,data FROM projects").all() as any[];
    for (const row of projects)
      if (audited.get(row.id) !== row.data)
        throw Error("Backup project/audit mismatch");
    for (const row of db
      .prepare("SELECT data FROM records WHERE kind='photo'")
      .all() as any[]) {
      const photo = JSON.parse(row.data),
        asset = db
          .prepare("SELECT sha256 FROM evidence WHERE id=?")
          .get(photo.assetId);
      if (!asset || asset.sha256 !== photo.sha256)
        throw Error("Backup photo reference/hash mismatch");
    }
    if (
      !projects.length ||
      projects.some(
        (p) => !JSON.parse(p.data).name.startsWith("[SYNTHETIC]"),
      ) ||
      !db.prepare("SELECT id FROM records WHERE kind='stagingDataset'").get()
    )
      throw Error("Only synthetic staging backups may be restored");
  } finally {
    db.close();
  }
}
function password(value: string) {
  if (value.length < 16)
    throw Error("Backup passphrase must have at least 16 characters");
}
export function encryptStagingBackup(
  source: string,
  destination: string,
  passphrase: string,
) {
  password(passphrase);
  if (!lstatSync(source).isFile() || lstatSync(source).isSymbolicLink())
    throw Error("Source must be a regular database");
  const folder = mkdtempSync(join(tmpdir(), "jr-private-backup-")),
    path = join(folder, "snapshot.sqlite"),
    prior = process.umask(0o077);
  try {
    backupDatabase(source, path);
    const db = new DatabaseSync(path);
    try {
      db.exec("DELETE FROM sessions");
    } finally {
      db.close();
    }
    verifyStagingBackup(path);
    const bytes = readFileSync(path);
    if (bytes.length > maxSize)
      throw Error("Staging backup exceeds size limit");
    const salt = randomBytes(16),
      iv = randomBytes(12),
      key = scryptSync(passphrase, salt, 32),
      cipher = createCipheriv("aes-256-gcm", key, iv),
      encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
    writeFileSync(
      destination,
      Buffer.concat([magic, salt, iv, cipher.getAuthTag(), encrypted]),
      { flag: "wx", mode: 0o600 },
    );
  } finally {
    process.umask(prior);
    rmSync(folder, { recursive: true, force: true });
  }
}
export function restoreStagingBackup(
  source: string,
  destination: string,
  passphrase: string,
) {
  password(passphrase);
  if (existsSync(destination))
    throw Error("Restore destination must be a new offline file");
  if (
    !lstatSync(source).isFile() ||
    lstatSync(source).isSymbolicLink() ||
    lstatSync(source).size > maxSize + 100
  )
    throw Error("Invalid encrypted backup file");
  const bytes = readFileSync(source);
  if (bytes.length < 54 || !bytes.subarray(0, 9).equals(magic))
    throw Error("Invalid encrypted backup format");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    scryptSync(passphrase, bytes.subarray(9, 25), 32),
    bytes.subarray(25, 37),
  );
  decipher.setAuthTag(bytes.subarray(37, 53));
  let decoded: Buffer;
  try {
    decoded = Buffer.concat([
      decipher.update(bytes.subarray(53)),
      decipher.final(),
    ]);
  } catch {
    throw Error(
      "Backup authentication failed; passphrase or file is incorrect",
    );
  }
  const folder = mkdtempSync(
      join(dirname(resolve(destination)), ".jr-restore-"),
    ),
    path = join(folder, "verified.sqlite"),
    prior = process.umask(0o077);
  try {
    writeFileSync(path, decoded, { flag: "wx", mode: 0o600 });
    verifyStagingBackup(path);
    const db = new DatabaseSync(path);
    try {
      db.exec("DELETE FROM sessions");
    } finally {
      db.close();
    }
    verifyStagingBackup(path);
    writeFileSync(destination, readFileSync(path), { flag: "wx", mode: 0o600 });
  } finally {
    process.umask(prior);
    rmSync(folder, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const [operation, source, destination] = process.argv.slice(2);
  if (!source || !destination || !["backup", "restore"].includes(operation))
    throw Error(
      "Usage: node scripts/staging-backup.ts backup|restore SOURCE NEW_DESTINATION < private-passphrase-file",
    );
  const passphrase = readFileSync(0, "utf8").trim();
  if (operation === "backup")
    encryptStagingBackup(source, destination, passphrase);
  else restoreStagingBackup(source, destination, passphrase);
  console.log(
    "Encrypted staging " +
      operation +
      " verified; keep the passphrase separately",
  );
}
