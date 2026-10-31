import { DatabaseSync } from "node:sqlite";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { mkdirSync, chmodSync } from "node:fs";
import { verifyIntegrity } from "./integrity.ts";
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
      verifyIntegrity(this.db);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  addUser(name: string, password: string, role: Role, company = "JR Roofing") {
    if (
      !["manager", "engineer", "supervisor", "worker", "viewer", "subcontractor-owner"].includes(role)
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
  snapshot(user: User): Snapshot {
    const projects = this.db
      .prepare("SELECT data FROM projects")
      .all()
      .map((x: any) => JSON.parse(x.data));
    const records = this.db
      .prepare("SELECT * FROM records ORDER BY seq")
      .all()
      .map((x: any) => ({
        id: x.id,
        pid: x.pid,
        kind: x.kind,
        author: x.author,
        createdAt: x.created_at,
        data: JSON.parse(x.data),
      }));
    if (user.role === "subcontractor-owner") {
      const authorised = projects.filter((p: any) => {
        const latest = records.filter((r) => r.pid === p.id && r.kind === "workforce.owner" && r.data.ownerId === user.id).at(-1);
        return latest?.data.active === true && latest.data.company === user.company;
      });
      return { projects: authorised, records: [], revision: records.filter(r => r.kind === "workforce.owner" && r.data.ownerId === user.id).length };
    }
    const visibleProjects =
      user.role === "worker"
        ? projects.filter(
            (p: any) =>
              records.some(
                (r) =>
                  r.pid === p.id &&
                  !r.kind.startsWith("workforce.") &&
                  (r.author === user.id ||
                    (r.kind === "allocation" && r.data.worker === user.id)),
              ) ||
              records
                .filter(
                  (r) =>
                    r.pid === p.id &&
                    r.kind === "workforce.allocation" &&
                    r.data.workerId === user.id,
                )
                .at(-1)?.data.active,
          )
        : projects;
    return {
      projects: visibleProjects,
      records: records.filter(
        (r) =>
          !r.kind.startsWith("workforce.") &&
          (user.role === "manager" || !r.kind.startsWith("commercial.")) &&
          (user.role !== "worker" ||
            (r.kind === "allocation" && r.data.worker === user.id) ||
            r.author === user.id),
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
