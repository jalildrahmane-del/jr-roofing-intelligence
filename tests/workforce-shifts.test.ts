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
test("shifts preserve revisions, reject overlap and never create verified attendance", () => {
  const { store, manager, worker, owner, outsider, pid, cmd } = fixture();
  try {
    const data = {
      workerId: worker.id,
      start: "2026-10-25T08:00:00Z",
      end: "2026-10-25T16:00:00Z",
      breakMinutes: 30,
      reason: "Fictional shift",
    };
    const first = cmd(manager, "shift", data);
    assert.equal(
      workforceState(store, worker, pid).schedules[0].plannedHours,
      7.5,
    );
    assert.deepEqual(workforceState(store, worker, pid).report, []);
    assert.throws(() => cmd(worker, "shift", data), /Forbidden/);
    assert.throws(
      () =>
        cmd(manager, "shift", { ...data, start: "2026-10-25T09:00:00+01:00" }),
      /overlapping/,
    );
    const revised = cmd(manager, "shift", {
      ...data,
      replaces: first.id,
      end: "2026-10-25T17:00:00Z",
    });
    assert.throws(
      () =>
        cmd(manager, "cancel-shift", { replaces: first.id, reason: "stale" }),
      /stale/,
    );
    cmd(manager, "owner", { ownerId: owner.id, active: true });
    cmd(manager, "shift", { ...data, workerId: outsider.id });
    assert.equal(workforceState(store, owner, pid).schedules.length, 1);
    assert.throws(
      () =>
        cmd(owner, "cancel-shift", { replaces: revised.id, reason: "denied" }),
      /Forbidden/,
    );
    cmd(manager, "cancel-shift", {
      replaces: revised.id,
      reason: "Weather cancellation",
    });
    assert.equal(
      workforceState(store, worker, pid).schedules[0].plannedHours,
      0,
    );
    assert.equal(
      workforceState(store, worker, pid).records.filter(
        (r) => r.kind === "workforce.shift",
      ).length,
      3,
    );
    cmd(manager, "shift", data);
  } finally {
    store.db.close();
  }
});
test("shift validation rejects impossible dates, durations and cross-project double booking", () => {
  const { store, key, manager, worker, pid, cmd } = fixture();
  try {
    const data = {
      workerId: worker.id,
      start: "2026-10-25T08:00:00Z",
      end: "2026-10-25T16:00:00Z",
      breakMinutes: 30,
      reason: "Fictional",
    };
    for (const patch of [
      { start: "2026-02-30T08:00:00Z" },
      { start: "2026-10-25T08:00" },
      { end: data.start },
      { breakMinutes: 480 },
      { breakMinutes: -1 },
      { breakMinutes: 0.5 },
      { end: "2026-10-27T16:00:00Z" },
    ])
      assert.throws(() => cmd(manager, "shift", { ...data, ...patch }));
    cmd(manager, "shift", data);
    const other = store.project(manager, { name: "Second fictional site" }).id;
    const run = (a: string, d: any) =>
      workforceCommand(store, manager, other, a, d, key);
    run("config", {
      latitude: 51,
      longitude: 0,
      radiusMetres: 100,
      supervisors: [],
      syntheticOnly: true,
    });
    run("allocation", {
      workerId: worker.id,
      active: true,
      shift: "Day",
      rate: 20,
    });
    assert.throws(() => run("shift", data), /overlapping/);
    run("shift", { ...data, start: data.end, end: "2026-10-25T18:00:00Z" });
  } finally {
    store.db.close();
  }
});
