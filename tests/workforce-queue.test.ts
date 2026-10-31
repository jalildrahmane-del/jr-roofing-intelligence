import test from "node:test";
import assert from "node:assert/strict";
import { readOfflineQueue } from "../src/workforce-queue.ts";
test("offline queue rejects corrupt shapes and preserves valid event identity", () => {
  for (const raw of ["{", "null", "{}", "[null]", "[1]", '[{"offline":false}]'])
    assert.throws(() => readOfflineQueue(raw));
  const events = [
    {
      event: "in",
      offline: true,
      requestId: "retry-id",
      capturedAt: "2026-10-28T08:00:00Z",
    },
  ];
  assert.deepEqual(readOfflineQueue(JSON.stringify(events)), events);
  assert.deepEqual(readOfflineQueue(null), []);
});
