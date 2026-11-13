import test from "node:test";
import assert from "node:assert/strict";
import { attendanceReport } from "../server/workforce.ts";
import type { RecordItem } from "../src/model.ts";

test("PR #14 reconciliation: worker total equals sum of displayed rounded shift amounts", () => {
  const records: RecordItem[] = [];
  const workerId = "synthetic-worker";
  let sequence = 0;
  const add = (kind: string, data: Record<string, unknown>, at: string) => {
    const id = `synthetic-${++sequence}`;
    records.push({ id, pid: "synthetic-project", kind, author: "synthetic-manager", createdAt: at, data });
    return id;
  };
  for (const day of ["2026-11-02", "2026-11-03", "2026-11-04"]) {
    // At £10.01/hour, 1-minute shifts each round to £0.17.
    // Rounding the aggregate unrounded value instead yields £0.50, not £0.51.
    const start = `${day}T08:00:00Z`;
    const end = `${day}T08:01:00Z`;
    const checkIn = add("workforce.event", { workerId, event: "in", rate: 10.01 }, start);
    add("workforce.review", { eventId: checkIn, decision: "accepted" }, start);
    const checkOut = add("workforce.event", { workerId, event: "out" }, end);
    add("workforce.review", { eventId: checkOut, decision: "accepted" }, end);
  }
  const [worker] = attendanceReport(records);
  assert.equal(worker.shifts.length, 3);
  assert.deepEqual(worker.shifts.map((shift: any) => shift.amount), [0.17, 0.17, 0.17]);
  assert.equal(worker.amount, 0.51);
  assert.equal(worker.amount, Math.round(worker.shifts.reduce((total: number, shift: any) => total + shift.amount, 0) * 100) / 100);
  assert.match(worker.paymentStatus, /not payment authorisation/);
});
