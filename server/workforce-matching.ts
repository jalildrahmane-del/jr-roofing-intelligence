import type { RecordItem } from "../src/model.ts";
import { latestShifts } from "./workforce-shifts.ts";
import { createHash } from "node:crypto";
// Conservative diagnostic only: ambiguous overlaps are never assigned automatically.
export function matchSchedules(records: RecordItem[], report: any[]) {
  const plans = latestShifts(records).filter((r) => !r.data.cancelled);
  const actual = report.flatMap((r) =>
    r.shifts.map((s: any) => ({ ...s, workerId: r.workerId })),
  );
  const overlaps = (p: RecordItem, a: any) =>
    p.data.workerId === a.workerId &&
    Number.isFinite(a.hours) && a.hours >= 0 && Date.parse(a.end)>Date.parse(a.start) &&
    Date.parse(a.start) < Date.parse(p.data.end) &&
    Date.parse(a.end) > Date.parse(p.data.start);
  return plans.map((p) => {
    const candidates = actual.filter((a) => overlaps(p, a));
    const unique =
      candidates.length === 1 &&
      plans.filter((other) => overlaps(other, candidates[0])).length === 1;
    const plannedHours =
      (Date.parse(p.data.end) - Date.parse(p.data.start)) / 3600000 -
      p.data.breakMinutes / 60;
    return {
      revisionId: p.id,
      planId:p.data.shiftId||p.id,
      plannedStart:p.data.start,plannedEnd:p.data.end,plannedBreakMinutes:p.data.breakMinutes,
      workerId: p.data.workerId,
      plannedHours,
      status: unique
        ? "Unique verified overlap"
        : candidates.length
          ? "Ambiguous — review required"
          : "No verified completed overlap",
      verifiedHours: unique ? candidates[0].hours : null,
      varianceHours: unique ? candidates[0].hours - plannedHours : null,
      actual:unique?candidates[0]:null,
      inputFingerprint:unique?createHash("sha256").update(JSON.stringify({plan:p,actual:candidates[0]})).digest("hex"):null,
      notice:
        "Time overlap only; not proof of scheduled work or payment approval",
    };
  });
}
export function plannedActualReport(records:RecordItem[],report:any[]) {
  const rows=matchSchedules(records,report).map(row=>{
    const latestMatch=records.filter(r=>r.kind==="workforce.match" && r.data.planId===row.planId).at(-1);
    const current=latestMatch && row.inputFingerprint && latestMatch.data.inputFingerprint===row.inputFingerprint && latestMatch.data.planRevisionId===row.revisionId;
    const matchStatus=latestMatch
      ? !current ? "Stale — recheck required" : latestMatch.data.decision==="confirmed"?"Confirmed":"Rejected"
      : row.actual?"Awaiting supervisor confirmation":row.status;
    return {...row,latestMatch:latestMatch||null,matchStatus,confirmed:!!current&&latestMatch?.data.decision==="confirmed"};
  });
  const actual=report.flatMap(r=>r.shifts.map((s:any)=>({...s,workerId:r.workerId})));
  const used=new Set(rows.filter(r=>r.confirmed).map(r=>r.actual?.attendanceId));
  const confirmed=rows.filter(r=>r.confirmed);
  return {
    rows,
    unconfirmedAttendance:actual.filter(a=>!used.has(a.attendanceId)),
    totals:{
      plannedHours:rows.reduce((sum,r)=>sum+r.plannedHours,0),
      verifiedHours:actual.reduce((sum,a)=>sum+a.hours,0),
      confirmedPlannedHours:confirmed.reduce((sum,r)=>sum+r.plannedHours,0),
      confirmedVerifiedHours:confirmed.reduce((sum,r)=>sum+(r.verifiedHours||0),0),
      confirmedVarianceHours:confirmed.reduce((sum,r)=>sum+(r.varianceHours||0),0),
      confirmedMatches:confirmed.length,
    },
    notice:"UTC times; net hours exclude recorded breaks. Comparisons and match confirmations are not payment authorisation or proof of physical presence.",
  };
}
