import test from "node:test";
import assert from "node:assert/strict";
import { matchSchedules } from "../server/workforce-matching.ts";
const plan = (id = "p", start = "08", end = "16") =>
  ({
    id,
    kind: "workforce.shift",
    data: {
      workerId: "w",
      start: `2026-10-26T${start}:00:00Z`,
      end: `2026-10-26T${end}:00:00Z`,
      breakMinutes: 30,
    },
  }) as any;
const report = [
  {
    workerId: "w",
    shifts: [
      { start: "2026-10-26T08:00:00Z", end: "2026-10-26T16:00:00Z", hours: 7 },
    ],
  },
];
test("schedule comparison uses verified net hours and never assumes attendance from plans", () => {
  assert.equal(matchSchedules([plan()], [])[0].verifiedHours, null);
  const r = matchSchedules([plan()], report)[0];
  assert.equal(r.varianceHours, -0.5);
  assert.equal(r.verifiedHours, 7);
  assert.equal(
    matchSchedules([plan()], [{ ...report[0], workerId: "other" }])[0]
      .verifiedHours,
    null,
  );
});
test("ambiguous, cancelled and superseded plans cannot double count attendance", () => {
  assert.ok(
    matchSchedules(
      [plan("a", "08", "12"), plan("b", "12", "16")],
      report,
    ).every((r) => r.verifiedHours === null),
  );
  assert.equal(
    matchSchedules(
      [
        plan(),
        {
          ...plan("revision"),
          data: { ...plan().data, shiftId: "p", cancelled: true },
        },
      ],
      report,
    ).length,
    0,
  );
  assert.equal(
    matchSchedules(
      [plan()],
      [{ ...report[0], shifts: [...report[0].shifts, ...report[0].shifts] }],
    )[0].verifiedHours,
    null,
  );
});
