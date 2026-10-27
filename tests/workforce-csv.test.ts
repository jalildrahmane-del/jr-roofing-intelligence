import test from "node:test";
import assert from "node:assert/strict";
import { attendanceCsv } from "../src/workforce-csv.ts";
test("timesheet CSV contains only completed report shifts and neutralises spreadsheet formulas", () => {
  const csv = attendanceCsv([
    {
      workerId: '=HYPERLINK("bad")',
      pending: 2,
      shifts: [
        {
          day: "2026-10-27",
          start: "2026-10-27T08:00:00Z",
          end: "2026-10-27T16:00:00Z",
          breakMinutes: 30,
          hours: 7.5,
          rate: 20,
          amount: 150,
        },
      ],
    },
  ]);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"150.00"'));
  assert.ok(csv.includes("not payment authorisation"));
  assert.equal(csv.split("\r\n").length, 3);
  assert.equal(
    attendanceCsv([{ workerId: "pending", pending: 1, shifts: [] }]),
    attendanceCsv([]),
  );
});
