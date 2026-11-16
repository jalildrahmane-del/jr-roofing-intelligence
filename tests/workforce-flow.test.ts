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
import type { User, RecordItem } from "../src/model.ts";
import { attendanceCsv } from "../src/workforce-csv.ts";
function setup() {
  const store = new Store(":memory:"),
    key = randomBytes(32);
  const users = ["manager", "supervisor", "worker", "viewer"].map((role) => ({
    id: store.addUser(role, "fictional-password", role as any),
    name: role,
    company: "Fictional",
    role,
  })) as User[];
  const [manager, supervisor, worker, viewer] = users;
  const pid = store.project(manager, { name: "Fictional" }).id;
  const cmd = (u: User, a: string, d: any) =>
    workforceCommand(store, u, pid, a, d, key) as any;
  cmd(manager, "config", {
    latitude: 51,
    longitude: 0,
    radiusMetres: 100,
    supervisors: [supervisor.id],
    syntheticOnly: true,
  });
  cmd(manager, "allocation", {
    workerId: worker.id,
    active: true,
    shift: "Day",
    rate: 20,
  });
  return { store, key, manager, supervisor, worker, viewer, pid, cmd };
}
test("attendance lifecycle: bound QR, independent review, privacy, replay and allocation revocation", () => {
  const { store, manager, supervisor, worker, viewer, pid, cmd } = setup();
  try {
    assert.throws(() => workforceState(store, viewer, pid), /Forbidden/);
    const token = cmd(supervisor, "challenge", {
      workerId: worker.id,
      event: "in",
    }).token;
    const now = new Date().toISOString(),
      d = {
        event: "in",
        token,
        fix: {
          latitude: 51,
          longitude: 0,
          accuracyMetres: 10,
          capturedAt: now,
        },
        capturedAt: now,
        offline: false,
        requestId: "request-1",
      };
    assert.throws(() => cmd(supervisor, "event", d), /workers submit/);
    const e = cmd(worker, "event", d);
    assert.equal(e.data.status, "pending");
    assert.equal(cmd(worker, "event", d).id, e.id);
    assert.throws(
      () =>
        cmd(worker, "review", {
          eventId: e.id,
          decision: "accepted",
          reason: "self",
        }),
      /Forbidden/,
    );
    cmd(supervisor, "review", {
      eventId: e.id,
      decision: "accepted",
      reason: "Observed arrival",
    });
    assert.throws(
      () =>
        cmd(worker, "event", { ...d, event: "out", requestId: "request-2" }),
      /QR/,
    );
    assert.equal(workforceState(store, worker, pid).report[0].verifiedHours, 0);
    const out = cmd(worker, "event", {
      ...d,
      event: "out",
      offline: true,
      requestId: "request-3",
    });
    assert.throws(
      () =>
        cmd(supervisor, "review", {
          eventId: out.id,
          decision: "accepted",
          reason: "Observed",
        }),
      /timestamp/,
    );
    cmd(supervisor, "review", {
      eventId: out.id,
      decision: "accepted",
      reason: "Observed exit",
      correctedAt: new Date().toISOString(),
    });
    assert.equal(
      store
        .snapshot(viewer)
        .records.some((r) => r.kind.startsWith("workforce.")),
      false,
    );
    cmd(manager, "allocation", {
      workerId: worker.id,
      active: false,
      shift: "Removed",
      rate: 20,
    });
    assert.throws(() => workforceState(store, worker, pid), /Forbidden/);
    assert.equal(store.snapshot(worker).projects.length, 0);
  } finally {
    store.close();
  }
});
test("uncertain GPS stays pending; outside GPS and failed validation do not consume QR", () => {
  const { store, supervisor, worker, cmd } = setup();
  try {
    const token = cmd(supervisor, "challenge", {
      workerId: worker.id,
      event: "in",
    }).token;
    const now = new Date().toISOString();
    const d = {
      event: "in",
      token,
      fix: { latitude: 52, longitude: 0, accuracyMetres: 10, capturedAt: now },
      capturedAt: now,
      offline: false,
      requestId: "a",
    };
    assert.throws(() => cmd(worker, "event", d), /outside/);
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM workforce_qr_redemptions").get()
        ?.n,
      0,
    );
    const e = cmd(worker, "event", {
      ...d,
      fix: { ...d.fix, latitude: 51, accuracyMetres: 110 },
    });
    assert.equal(e.data.gps.status, "uncertain");
    assert.equal(e.data.status, "pending");
  } finally {
    store.close();
  }
});
test("cross-project overlaps withhold only conflicting reviewed shifts until correction", () => {
  const { store, key, manager, supervisor, worker, pid, cmd } = setup();
  try {
    const otherPid = store.project(manager, { name: "Separate synthetic project" }).id;
    const otherSupervisor = {
      ...supervisor,
      name: "other-supervisor",
      id: store.addUser("other-supervisor", "fictional-password", "supervisor"),
    };
    const otherCmd = (u: User, action: string, data: unknown) => workforceCommand(store, u, otherPid, action, data, key);
    otherCmd(manager, "config", {
      latitude: 51,
      longitude: 0,
      radiusMetres: 100,
      supervisors: [otherSupervisor.id],
      syntheticOnly: true,
    });
    otherCmd(manager, "allocation", { workerId: worker.id, active: true, shift: "Day", rate: 20 });

    const workDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const stamp = (hour: string) => `${workDate}T${hour}:00:00.000Z`;
    function recordShift(send: typeof cmd, reviewer: User, start: string, end: string) {
      return (["in", "out"] as const).map((event, index) => {
        const capturedAt = stamp(index === 0 ? start : end);
        const record = send(worker, "event", { event, offline: true, capturedAt, requestId: `${event}-${capturedAt}` });
        send(reviewer, "review", { eventId: record.id, decision: "accepted", reason: "Synthetic record verified", correctedAt: capturedAt });
        return record.id as string;
      });
    }
    const firstShift = recordShift(cmd, supervisor, "09", "13");
    const adjacentShift = recordShift(cmd, supervisor, "16", "18");
    const plan = cmd(supervisor, "shift", { workerId: worker.id, start: stamp("09"), end: stamp("13"), breakMinutes: 0, reason: "Synthetic plan" });
    const candidate = workforceState(store, supervisor, pid).comparison.rows[0];
    const matchRequest = { planRevisionId: plan.id, inputFingerprint: candidate.inputFingerprint, decision: "confirmed", attest: true, reason: "Synthetic confirmation" };
    cmd(supervisor, "match", matchRequest);
    assert.equal(workforceState(store, supervisor, pid).comparison.rows[0].matchStatus, "Confirmed");
    const overlappingShift = recordShift(otherCmd, otherSupervisor, "12", "16");

    const scoped = workforceState(store, supervisor, pid);
    assert.equal(scoped.report[0].verifiedHours, 2);
    assert.equal(scoped.report[0].amount, 40);
    assert.deepEqual(scoped.report[0].shifts[0].eventIds, adjacentShift);
    assert.match(scoped.report[0].exceptions[0], /overlapping attendance on another project/);
    assert.match(attendanceCsv(scoped.report), /T16:00:00/);
    assert.doesNotMatch(attendanceCsv(scoped.report), /T09:00:00/);
    assert.equal(scoped.comparison.rows[0].matchStatus, "Stale — recheck required");
    assert.throws(() => cmd(supervisor, "match", matchRequest), /current unique verified overlap/);
    assert.ok(scoped.records.some(record => record.id === firstShift[0]));
    assert.ok(!JSON.stringify(scoped).includes(otherPid));
    assert.ok(!JSON.stringify(scoped).includes(overlappingShift[0]));
    assert.throws(() => workforceState(store, supervisor, otherPid), /Forbidden/);
    assert.equal(workforceState(store, otherSupervisor, otherPid).report[0].verifiedHours, 0);
    assert.equal(workforceState(store, otherSupervisor, otherPid).report[0].amount, 0);

    const reconciliation = cmd(manager, "reconcile", { workerId: worker.id, claimedAmount: 120, note: "Synthetic claim" });
    assert.equal(reconciliation.data.report.verifiedHours, 2);
    assert.equal(reconciliation.data.variance, 80);

    otherCmd(otherSupervisor, "review", {
      eventId: overlappingShift[0],
      decision: "accepted",
      reason: "Confirmed handoff at the first project's checkout time",
      correctedAt: stamp("13"),
    });
    assert.equal(workforceState(store, supervisor, pid).report[0].verifiedHours, 6);
    assert.equal(workforceState(store, otherSupervisor, otherPid).report[0].verifiedHours, 3);
    assert.deepEqual(workforceState(store, supervisor, pid).report[0].exceptions, []);
    const history = workforceState(store, manager, otherPid).records;
    assert.equal(history.filter(record => record.kind === "workforce.review" && record.data.eventId === overlappingShift[0]).length, 2);
    assert.equal(workforceState(store, manager, pid).records.find(record => record.id === reconciliation.id)?.data.report.verifiedHours, 2);
  } finally {
    store.close();
  }
});

test("reconciliation deducts breaks and excludes incomplete or rejected sequences", () => {
  const records: RecordItem[] = [];
  for (const [i, event] of [
    "in",
    "break-start",
    "break-end",
    "out",
  ].entries()) {
    const e = {
      id: "e" + i,
      pid: "p",
      author: "worker",
      kind: "workforce.event",
      createdAt: `2026-10-19T${["08", "12", "13", "17"][i]}:00:00Z`,
      data: { workerId: "w", event },
    };
    records.push(e, {
      ...e,
      id: "r" + i,
      author: "supervisor",
      kind: "workforce.review",
      data: { workerId: "w", eventId: e.id, decision: "accepted" },
    });
  }
  assert.equal(attendanceReport(records)[0].verifiedHours, 8);
  records.pop();
  assert.equal(attendanceReport(records)[0].verifiedHours, 0);
});
test("workforce HTTP rejects anonymous, unallocated and malformed requests", async () => {
  const { store, manager, pid } = setup();
  const server = createApp(store);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    assert.equal((await fetch(base + "/api/workforce?pid=" + pid)).status, 401);
    const token = store.login(manager.name, "fictional-password")!;
    const headers = {
      Cookie: "jr_session=" + token,
      Origin: base,
      "Content-Type": "application/json",
    };
    assert.equal(
      (await fetch(base + "/api/workforce?pid=" + pid, { headers })).status,
      200,
    );
    assert.equal(
      (
        await fetch(base + "/api/workforce", {
          method: "POST",
          headers,
          body: JSON.stringify({ pid, action: "event", data: null }),
        })
      ).status,
      400,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
  }
});
