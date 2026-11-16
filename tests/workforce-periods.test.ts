import test from "node:test";
import assert from "node:assert/strict";
import {workforcePeriodSummary} from "../src/workforce-periods.ts";
test("UTC weekly and daily workforce summaries deduplicate candidate and unconfirmed attendance",()=>{
 const actual={attendanceId:"a1",start:"2026-11-01T23:00:00Z",hours:3};
 const comparison={rows:[{plannedStart:"2026-10-31T20:00:00Z",plannedHours:5,confirmed:false,actual}],unconfirmedAttendance:[actual,{attendanceId:"a2",start:"2026-11-02T08:00:00Z",hours:4}]};
 const daily=workforcePeriodSummary(comparison,"day");
 assert.deepEqual(daily.map(x=>[x.period,x.plannedHours,x.verifiedHours]),[["2026-10-31",5,0],["2026-11-01",0,3],["2026-11-02",0,4]]);
 const weekly=workforcePeriodSummary(comparison,"week");
 assert.deepEqual(weekly.map(x=>[x.period,x.plannedHours,x.verifiedHours]),[["2026-10-26",5,3],["2026-11-02",0,4]]);
});
