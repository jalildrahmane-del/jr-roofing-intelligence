import type { DatabaseSync } from "node:sqlite";

export const schemaVersion = 3;

// Add a numbered migration here for future schema changes; never edit an applied one.
const initialSchema = `
CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,password TEXT NOT NULL,role TEXT NOT NULL,company TEXT NOT NULL);
CREATE TABLE sessions(hash TEXT PRIMARY KEY,uid TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE projects(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE records(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,pid TEXT NOT NULL REFERENCES projects(id),kind TEXT NOT NULL,author TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,data TEXT NOT NULL);
CREATE TABLE audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,at TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,previous_hash TEXT NOT NULL,hash TEXT NOT NULL);`;

export function migrate(db: DatabaseSync) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(
      "CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    const versions = db
      .prepare("SELECT version FROM migrations ORDER BY version")
      .all()
      .map((x) => Number(x.version));
    if (versions.some((v, i) => v !== i + 1 || v > schemaVersion))
      throw Error(
        "Unsupported database schema; restore the matching application version",
      );
    if (!versions.length) {
      db.exec(initialSchema);
      db.prepare("INSERT INTO migrations VALUES(?,?)").run(
        1,
        new Date().toISOString(),
      );
    }
    if (!versions.includes(2)) {
      db.exec(
        "CREATE TABLE evidence(id TEXT PRIMARY KEY,pid TEXT NOT NULL REFERENCES projects(id),mime TEXT NOT NULL,bytes BLOB NOT NULL,sha256 TEXT NOT NULL)",
      );
      db.prepare("INSERT INTO migrations VALUES(?,?)").run(
        2,
        new Date().toISOString(),
      );
    }
    if (!versions.includes(3)) {
      db.exec(`CREATE TABLE project_members(pid TEXT NOT NULL REFERENCES projects(id),uid TEXT NOT NULL REFERENCES users(id),access TEXT NOT NULL CHECK(access IN ('read','write','admin')),PRIMARY KEY(pid,uid));
      CREATE TABLE document_files(id TEXT PRIMARY KEY,pid TEXT NOT NULL REFERENCES projects(id),mime TEXT NOT NULL,bytes BLOB NOT NULL,sha256 TEXT NOT NULL,name TEXT NOT NULL);
      INSERT INTO project_members(pid,uid,access)
      SELECT p.id,u.id,CASE WHEN u.id=a.actor THEN 'admin' ELSE CASE WHEN u.role='viewer' THEN 'read' ELSE 'write' END END
      FROM projects p JOIN audit a ON a.action='project.create' AND json_extract(a.detail,'$.id')=p.id
      JOIN users owner ON owner.id=a.actor JOIN users u ON u.company=owner.company AND u.role!='worker';`);
      db.prepare("INSERT INTO migrations VALUES(?,?)").run(
        3,
        new Date().toISOString(),
      );
    }
    db.prepare("SELECT pid,uid,access FROM project_members LIMIT 0").all();
    db.prepare(
      "SELECT id,pid,mime,bytes,sha256,name FROM document_files LIMIT 0",
    ).all();
    db.prepare("SELECT id,pid,mime,bytes,sha256 FROM evidence LIMIT 0").all();
    // Fail closed if a file claims version 1 but its required schema is incomplete.
    db.prepare("SELECT id,name,password,role,company FROM users LIMIT 0").all();
    db.prepare("SELECT hash,uid,expires FROM sessions LIMIT 0").all();
    db.prepare("SELECT id,data FROM projects LIMIT 0").all();
    db.prepare(
      "SELECT seq,id,pid,kind,author,created_at,data FROM records LIMIT 0",
    ).all();
    db.prepare(
      "SELECT seq,at,actor,action,detail,previous_hash,hash FROM audit LIMIT 0",
    ).all();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
