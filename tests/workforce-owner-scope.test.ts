import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Store } from "../server/store.ts";
import {
  workforceCommand,
  workforceState,
  attendanceReport,
} from "../server/workforce.ts";
import { createApp } from "../server/index.ts";
import type { User, Role, RecordItem } from "../src/model.ts";
function fixture() {
  const store = new Store(":memory:"),
    key = randomBytes(32);
  const add = (name: string, role: Role, company = "Main") => ({
    id: store.addUser(name, "fictional-password", role, company),
    name,
    role,
    company,
  });
  const manager = add("manager", "manager"),
    owner = add("owner", "subcontractor-owner", "Alpha"),
    other = add("other", "subcontractor-owner", "Beta"),
    worker = add("worker", "worker", "Alpha"),
    outsider = add("outsider", "worker", "Beta");
  const pid = store.project(manager, { name: "Fictional roof" }).id;
  const cmd = (actor: User, action: string, data: any) =>
    workforceCommand(store, actor, pid, action, data, key) as any;
  cmd(manager, "config", {
    latitude: 51,
    longitude: 0,
    radiusMetres: 100,
    supervisors: [],
    syntheticOnly: true,
  });
  for (const w of [worker, outsider])
    cmd(manager, "allocation", {
      workerId: w.id,
      active: true,
      shift: "Day",
      rate: 20,
    });
  return { store, key, manager, owner, other, worker, outsider, pid, cmd };
}
test("subcontractor owner requires manager grant and only sees own company without exact GPS", () => {
  const { store, manager, owner, other, worker, outsider, pid, cmd } =
    fixture();
  try {
    assert.throws(() => workforceState(store, owner, pid), /Forbidden/);
    assert.equal(store.snapshot(owner).projects.length, 0);
    cmd(manager, "owner", { ownerId: owner.id, active: true });
    assert.throws(() => workforceState(store, other, pid), /Forbidden/);
    for (const w of [worker, outsider]) {
      const capturedAt = new Date().toISOString(),
        token = cmd(manager, "challenge", {
          workerId: w.id,
          event: "in",
        }).token;
      cmd(w, "event", {
        event: "in",
        token,
        offline: false,
        capturedAt,
        requestId: w.id,
        fix: { latitude: 51, longitude: 0, accuracyMetres: 5, capturedAt },
      });
    }
    const state = workforceState(store, owner, pid);
    assert.equal(state.report.length, 1);
    assert.equal(state.report[0].workerId, worker.id);
    assert.ok(!JSON.stringify(state).includes(outsider.id));
    assert.ok(state.records.every((r) => !r.data.fix && !r.data.gps));
    assert.equal(state.config?.latitude, undefined);
    assert.equal(state.users.length, 0);
    assert.deepEqual(state.people, [{id:worker.id,name:worker.name,company:worker.company}]);
    assert.deepEqual(workforceState(store, worker, pid).people, [{id:worker.id,name:worker.name,company:worker.company}]);
    const unassigned = store.addUser("unassigned-company-worker", "fictional-password", "worker", "Alpha");
    assert.ok(!JSON.stringify(workforceState(store, owner, pid)).includes(unassigned));
    assert.equal(store.snapshot(owner).records.length, 0);
    for (const action of [
      "owner",
      "review",
      "challenge",
      "allocation",
      "event",
      "progress",
      "reconcile",
      "config",
    ])
      assert.throws(
        () => cmd(owner, action, { workerId: worker.id }),
        /Forbidden/,
      );
    cmd(manager, "allocation", {workerId:worker.id,active:false,shift:"Day",rate:20});
    assert.deepEqual(workforceState(store, owner, pid).people, state.people, "Names remain available for authorised historical records");
    cmd(manager, "owner", { ownerId: owner.id, active: false });
    assert.throws(() => workforceState(store, owner, pid), /Forbidden/);
    assert.equal(store.snapshot(owner).projects.length, 0);
  } finally {
    store.close();
  }
});
test("owner HTTP access cannot leak dossiers, photos, documents, other projects or write records", async () => {
  const { store, manager, owner, pid, cmd } = fixture();
  cmd(manager, "owner", { ownerId: owner.id, active: true });
  const otherPid = store.project(manager, { name: "Private project" }).id;
  const server = createApp(store);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`,
    token = store.login(owner.name, "fictional-password"),
    headers = {
      Cookie: "jr_session=" + token,
      Origin: base,
      "Content-Type": "application/json",
    };
  try {
    for (const path of [
      "dossiers/" + pid,
      "evidence/anything",
      "document-intelligence?pid=" + pid,
      "document-pdf?pid=" + pid,
      "reports/anything",
    ])
      assert.equal(
        (await fetch(base + "/api/" + path, { headers })).status,
        403,
        path,
      );
    assert.equal(
      (await fetch(base + "/api/workforce?pid=" + otherPid, { headers }))
        .status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/api/projects", {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/api/records", {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status,
      403,
    );
    const state = (await (
      await fetch(base + "/api/state", { headers })
    ).json()) as any;
    assert.equal(state.projects.length, 1);
    assert.equal(state.projects[0].id, pid);
    assert.deepEqual(state.records, []);
    cmd(manager, "owner", { ownerId: owner.id, active: false });
    assert.equal(
      (await fetch(base + "/api/workforce?pid=" + pid, { headers })).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/api/logout", {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status,
      200,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
  }
});
