import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Store } from "../server/store.ts";
import { workforceCommand, workforceState } from "../server/workforce.ts";

test("planned shifts integrate with current workforce records, revisions and cancellation", () => {
  const store = new Store(":memory:");
  const key = randomBytes(32);
  try {
    const manager = { id: store.addUser("shift-manager", "test-password-123", "manager"), name: "shift-manager", role: "manager" as const, company: "JR Roofing" };
    const worker = { id: store.addUser("shift-worker", "test-password-123", "worker"), name: "shift-worker", role: "worker" as const, company: "JR Roofing" };
    const project = store.project(manager, { name: "Synthetic shift site" });
    const cmd = (action: string, data: any) => workforceCommand(store, manager, project.id, action, data, key) as any;
    cmd("config", { latitude: 51, longitude: 0, radiusMetres: 100, supervisors: [], syntheticOnly: true });
    cmd("allocation", { workerId: worker.id, active: true, shift: "Day", rate: 20 });
    const data = { workerId: worker.id, start: "2026-11-02T08:00:00Z", end: "2026-11-02T16:00:00Z", breakMinutes: 30, reason: "Synthetic planned shift" };
    const first = cmd("shift", data);
    assert.equal(first.kind, "workforce.shift");
    assert.equal(workforceState(store, manager, project.id).schedules[0].plannedHours, 7.5);
    assert.throws(() => cmd("shift", { ...data, start: "2026-11-02T10:00:00Z" }), /overlapping shift/);
    assert.throws(() => cmd("shift", { ...data, start: "2026-02-30T08:00:00Z" }), /Invalid shift date\/time/);
    const revised = cmd("shift", { ...data, replaces: first.id, end: "2026-11-02T17:00:00Z", reason: "Revised synthetic shift" });
    assert.equal(workforceState(store, manager, project.id).schedules.length, 1);
    assert.equal(workforceState(store, manager, project.id).schedules[0].plannedHours, 8.5);
    assert.throws(() => cmd("cancel-shift", { replaces: first.id, reason: "Stale" }), /stale or cancelled/);
    cmd("cancel-shift", { replaces: revised.id, reason: "Cancelled synthetic plan" });
    assert.equal(workforceState(store, manager, project.id).schedules[0].plannedHours, 0);
    assert.equal(workforceState(store, manager, project.id).report.length, 0, "Planned shifts never imply verified attendance");
    assert.throws(() => workforceCommand(store, worker, project.id, "shift", data, key), /Forbidden: supervisor required/);
  } finally {
    store.close();
  }
});
