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

test("offline queue rejects duplicate request IDs instead of silently conflating events", () => {
  const first={event:"in",offline:true,requestId:"same-retry-id",capturedAt:"2026-11-06T08:00:00Z"};
  const second={...first,event:"out",capturedAt:"2026-11-06T17:00:00Z"};
  assert.throws(()=>readOfflineQueue(JSON.stringify([first,second])),/duplicate event IDs/);
  assert.equal(readOfflineQueue(JSON.stringify([first,{...second,requestId:"different-retry-id"}])).length,2);
});
