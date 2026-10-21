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
test("shift-rounded monetary totals exactly reconcile and comparison becomes stale after review changes", () => {
  const rows: RecordItem[] = [];
  for (let day = 1; day <= 2; day++) {
    for (const [i, event] of ["in", "out"].entries()) {
      const r = {
        id: `${day}-${i}`,
        pid: "p",
        kind: "workforce.event",
        author: "w",
        createdAt: `2026-10-0${day}T08:0${i}:00.000Z`,
        data: { workerId: "w", event, rate: 1 },
      };
      rows.push(r, {
        ...r,
        id: "review" + r.id,
        kind: "workforce.review",
        data: { workerId: "w", eventId: r.id, decision: "accepted" },
      });
    }
  }
  const report = attendanceReport(rows)[0];
  assert.equal(report.amount, 0.04);
  assert.equal(
    report.shifts.reduce(
      (sum: number, r: any) => sum + Math.round(r.amount * 100),
      0,
    ),
    Math.round(report.amount * 100),
  );
  const { store, manager, worker, pid, cmd } = fixture();
  try {
    const e = cmd(worker, "event", {
      event: "in",
      offline: true,
      requestId: "a",
      capturedAt: new Date().toISOString(),
    });
    cmd(manager, "reconcile", {
      workerId: worker.id,
      claimedAmount: 0,
      note: "Initial comparison",
    });
    assert.equal(
      workforceState(store, manager, pid).reconciliations[0].current,
      true,
    );
    cmd(manager, "review", {
      eventId: e.id,
      decision: "rejected",
      reason: "Not verified",
    });
    assert.equal(
      workforceState(store, manager, pid).reconciliations[0].current,
      false,
    );
  } finally {
    store.close();
  }
});
test("impossible calendar dates and conflicting retry identifiers fail without appending records", () => {
  const { store, worker, cmd } = fixture();
  try {
    const d = {
      event: "in",
      offline: true,
      requestId: "same",
      capturedAt: new Date().toISOString(),
    };
    const first = cmd(worker, "event", d);
    assert.equal(cmd(worker, "event", d).id, first.id);
    assert.throws(
      () => cmd(worker, "event", { ...d, event: "out" }),
      /different event/,
    );
    assert.throws(
      () =>
        cmd(worker, "progress", {
          day: "2026-02-30",
          quantity: 1,
          unit: "m2",
          description: "Test",
          evidence: "Photo",
        }),
      /Invalid work date/,
    );
  } finally {
    store.close();
  }
});
