import test from "node:test";
import assert from "node:assert/strict";
import { summariseAttendance } from "../src/workforce-summary.ts";
import type { RecordItem } from "../src/model.ts";
const make = (id: string, pid: string, workerId: string, event: string, reviewStatus: string): RecordItem => ({
  id, pid, kind: "attendance", author: "supervisor", createdAt: "2026-10-20T10:00:00Z",
  data: { workerId, event, reviewStatus, serverAt: "2026-10-20T10:00:00Z" }
});
test("attendance summary filters by project and distinguishes pending reviews", () => {
  const result = summariseAttendance([
    make("1", "a", "worker-1", "in", "pending"),
    make("2", "a", "worker-1", "out", "accepted"),
    make("3", "b", "worker-1", "in", "rejected"),
    make("4", "a", "worker-2", "in", "rejected")
  ], "a");
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    workerId: "worker-1", checkIns: 1, checkOuts: 1,
    pendingReviews: 1, acceptedReviews: 1, rejectedReviews: 0,
    lastEventAt: "2026-10-20T10:00:00Z"
  });
  assert.equal(result[1].rejectedReviews, 1);
});
test("empty project has no attendance summary", () => {
  assert.deepEqual(summariseAttendance([], "missing"), []);
});
