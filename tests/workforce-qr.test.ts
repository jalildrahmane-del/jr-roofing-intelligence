import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createAttendanceChallenge, redeemAttendanceChallenge } from "../src/workforce-qr.ts";
const secret = randomBytes(32);
const now = Date.parse("2026-10-20T12:00:00Z");
test("valid signed challenge redeems once only", () => {
  const c = createAttendanceChallenge(secret, "site-1", now);
  const used = new Set<string>();
  assert.equal(redeemAttendanceChallenge(secret, c.token, "site-1", used, now + 1000), true);
  assert.equal(redeemAttendanceChallenge(secret, c.token, "site-1", used, now + 2000), false);
});
test("wrong project, tampering and expiry are rejected", () => {
  const c = createAttendanceChallenge(secret, "site-1", now);
  assert.equal(redeemAttendanceChallenge(secret, c.token, "site-2", new Set(), now), false);
  assert.equal(redeemAttendanceChallenge(secret, c.token + "x", "site-1", new Set(), now), false);
  assert.equal(redeemAttendanceChallenge(secret, c.token, "site-1", new Set(), now + 61000), false);
  assert.equal(redeemAttendanceChallenge(randomBytes(32), c.token, "site-1", new Set(), now), false);
});
test("weak signing key and unreasonable lifetime rejected", () => {
  assert.throws(() => createAttendanceChallenge(Buffer.alloc(8), "site-1", now), /short/);
  assert.throws(() => createAttendanceChallenge(secret, "site-1", now, 999999), /lifetime/);
});
