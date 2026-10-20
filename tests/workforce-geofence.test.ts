import test from "node:test";
import assert from "node:assert/strict";
import { assessAttendanceFix } from "../src/workforce-geofence.ts";
const now = Date.parse("2026-10-20T12:00:00Z");
const site = { latitude: 51.5074, longitude: -0.1278, radiusMetres: 100 };
const fix = (latitude: number, accuracyMetres: number, capturedAt = new Date(now).toISOString()) =>
  ({ latitude, longitude: site.longitude, accuracyMetres, capturedAt });
test("clear inside fix is evidence only, not automatic verified attendance", () => {
  const result = assessAttendanceFix(site, fix(site.latitude, 10), now);
  assert.equal(result.status, "within");
  assert.match(result.reason, /supervisor verification/);
});
test("clear outside fix is rejected", () => {
  assert.equal(assessAttendanceFix(site, fix(site.latitude + 0.01, 10), now).status, "outside");
});
test("boundary overlapping GPS uncertainty requires manual review", () => {
  assert.equal(assessAttendanceFix(site, fix(site.latitude + 0.0009, 40), now).status, "uncertain");
});
test("stale, future, invalid and impossible fixes fail closed", () => {
  assert.throws(() => assessAttendanceFix(site, fix(site.latitude, 10, new Date(now - 180000).toISOString()), now), /stale/);
  assert.throws(() => assessAttendanceFix(site, fix(site.latitude, 10, new Date(now + 10000).toISOString()), now), /stale/);
  assert.throws(() => assessAttendanceFix(site, fix(99, 10), now), /coordinates/);
  assert.throws(() => assessAttendanceFix(site, fix(site.latitude, -1), now), /accuracy/);
  assert.throws(() => assessAttendanceFix({ ...site, radiusMetres: 0 }, fix(site.latitude, 10), now), /radius/);
});
