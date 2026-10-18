import { DatabaseSync } from "node:sqlite";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { mkdirSync, chmodSync } from "node:fs";
import { migrate } from "./migrations.ts";
import { dirname } from "node:path";
import type { Role, User, Snapshot, RecordItem } from "../src/model.ts";
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    try {
      if (path !== ":memory:") chmodSync(path, 0o600);
      this.db.exec(
        "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;",
      );
      migrate(this.db);
      if (this.db.prepare("PRAGMA quick_check").get()?.quick_check !== "ok")
        throw Error("Database integrity check failed");
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  addUser(name: string, password: string, role: Role, company = "JR Roofing") {
    if (
      !["manager", "engineer", "supervisor", "worker", "viewer"].includes(role)
    )
      throw Error("Invalid role");
    if (password.length < 12)
      throw Error("Password must have at least 12 characters");
    const salt = randomBytes(16).toString("hex"),
      hash = scryptSync(password, salt, 64).toString("hex"),
      id = randomUUID();
    this.db
      .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
      .run(id, name, `${salt}:${hash}`, role, company);
    return id;
  }
  login(name: string, password: string) {
    const u = this.db
      .prepare("SELECT * FROM users WHERE name=?")
      .get(name) as any;
    if (!u) return null;
    const [salt, hash] = u.password.split(":");
    if (
      !timingSafeEqual(Buffer.from(hash, "hex"), scryptSync(password, salt, 64))
    )
      return null;
    const token = randomBytes(32).toString("hex");
    this.db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(
        createHash("sha256").update(token).digest("hex"),
        u.id,
        Date.now() + 8 * 3600000,
      );
    return token;
  }
  user(token: string): User | null {
    const u = this.db
      .prepare(
        "SELECT u.id,u.name,u.role,u.company FROM users u JOIN sessions s ON u.id=s.uid WHERE s.hash=? AND s.expires>?",
      )
      .get(createHash("sha256").update(token).digest("hex"), Date.now()) as
      | User
      | undefined;
    return u || null;
  }
  logout(token: string) {
    this.db
      .prepare("DELETE FROM sessions WHERE hash=?")
      .run(createHash("sha256").update(token).digest("hex"));
  }
  access(user: User, pid: string): string | undefined {
    return (
      this.db
        .prepare("SELECT access FROM project_members WHERE pid=? AND uid=?")
        .get(pid, user.id) as any
    )?.access;
  }
  canRead(user: User, pid: string) {
    return !!this.access(user, pid);
  }
  canWrite(user: User, pid: string) {
    return (
      ["manager", "engineer", "supervisor"].includes(user.role) &&
      ["write", "admin"].includes(this.access(user, pid) || "")
    );
  }
  setAccess(actor: User, pid: string, uid: string, access: string) {
    if (actor.role !== "manager" || this.access(actor, pid) !== "admin")
      throw Error("Forbidden: project administrator required");
    if (!["read", "write", "admin", "none"].includes(access))
      throw Error("Invalid project access");
    const target = this.db
      .prepare("SELECT id,name,role,company FROM users WHERE id=?")
      .get(uid) as User | undefined;
    if (!target || target.company !== actor.company)
      throw Error("Account not found in your company");
    if (access === "admin" && target.role !== "manager")
      throw Error("Only a manager can administer a project");
    this.transaction(() => {
      if (
        this.access(target, pid) === "admin" &&
        access !== "admin" &&
        Number(
          this.db
            .prepare(
              "SELECT count(*) n FROM project_members WHERE pid=? AND access='admin'",
            )
            .get(pid)!.n,
        ) <= 1
      )
        throw Error("Keep at least one project administrator");
      if (access === "none")
        this.db
          .prepare("DELETE FROM project_members WHERE pid=? AND uid=?")
          .run(pid, uid);
      else
        this.db
          .prepare(
            "INSERT INTO project_members(pid,uid,access) VALUES(?,?,?) ON CONFLICT(pid,uid) DO UPDATE SET access=excluded.access",
          )
          .run(pid, uid, access);
      this.audit(actor.id, "project.access", { pid, uid, access });
    });
  }
  snapshot(user: User): Snapshot {
    const projects = this.db
      .prepare(
        "SELECT p.data FROM projects p JOIN project_members m ON p.id=m.pid WHERE m.uid=?",
      )
      .all(user.id)
      .map((x: any) => JSON.parse(x.data));
    const records = this.db
      .prepare(
        "SELECT r.* FROM records r JOIN project_members m ON r.pid=m.pid WHERE m.uid=? ORDER BY r.seq",
      )
      .all(user.id)
      .map((x: any) => ({
        id: x.id,
        pid: x.pid,
        kind: x.kind,
        author: x.author,
        createdAt: x.created_at,
        data: JSON.parse(x.data),
      }));
    return {
      projects,
      records: records.filter(
        (r) =>
          user.role !== "worker" ||
          (r.kind === "allocation" && r.data.worker === user.id) ||
          r.author === user.id,
      ),
      revision: Number(
        (this.db.prepare("SELECT count(*) AS n FROM audit").get() as any).n,
      ),
    };
  }

  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const x = fn();
      this.db.exec("COMMIT");
      return x;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  audit(actor: string, action: string, detail: unknown) {
    const previous =
      (
        this.db
          .prepare("SELECT hash FROM audit ORDER BY seq DESC LIMIT 1")
          .get() as any
      )?.hash || "genesis";
    const at = new Date().toISOString(),
      d = JSON.stringify(detail),
      hash = createHash("sha256")
        .update(JSON.stringify([at, actor, action, d, previous]))
        .digest("hex");
    this.db
      .prepare(
        "INSERT INTO audit(at,actor,action,detail,previous_hash,hash) VALUES(?,?,?,?,?,?)",
      )
      .run(at, actor, action, d, previous, hash);
  }
  project(user: User, data: any) {
    if (user.role !== "manager")
      throw Error("Forbidden: manager role required");
    const id = randomUUID();
    const p = { ...data, id, status: "Pre-construction" };
    this.transaction(() => {
      this.db
        .prepare("INSERT INTO projects VALUES(?,?)")
        .run(id, JSON.stringify(p));
      this.db
        .prepare("INSERT INTO project_members VALUES(?,?,?)")
        .run(id, user.id, "admin");
      this.audit(user.id, "project.create", p);
    });
    return p;
  }
  append(
    user: User,
    pid: string,
    kind: string,
    data: Record<string, any>,
  ): RecordItem {
    const r = {
      id: randomUUID(),
      pid,
      kind,
      author: user.id,
      createdAt: new Date().toISOString(),
      data,
    };
    this.db
      .prepare(
        "INSERT INTO records(id,pid,kind,author,created_at,data) VALUES(?,?,?,?,?,?)",
      )
      .run(r.id, pid, kind, user.id, r.createdAt, JSON.stringify(data));
    this.audit(user.id, kind, r);
    return r;
  }
  close() {
    this.db.close();
  }
}
