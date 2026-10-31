// Input must be the already-authorised workforce API report, never raw records.
export const csvCell = (v: unknown) => {
    let s = String(v ?? "");
    if (typeof v === "string" && (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s))) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
};
export function attendanceCsv(report: any[]): string {
  const rows: unknown[][] = [
    [
      "Worker ID",
      "UTC day",
      "Verified start UTC",
      "Verified finish UTC",
      "Verified break minutes",
      "Verified hours",
      "Recorded hourly rate GBP",
      "Calculated amount GBP",
      "Status",
    ],
  ];
  for (const worker of report)
    for (const shift of worker.shifts || [])
      rows.push([
        worker.workerId,
        shift.day,
        shift.start,
        shift.end,
        shift.breakMinutes,
        shift.hours,
        shift.rate,
        Number(shift.amount).toFixed(2),
        "Verified attendance calculation; not payment authorisation",
      ]);
  return (
    "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n"
  );
}
export function plannedActualCsv(comparison:any):string {
  const rows:unknown[][]=[["Row type","Worker ID","Plan revision","Planned start UTC","Planned end UTC","Planned break minutes","Planned net hours","Verified start UTC","Verified end UTC","Verified break minutes","Verified net hours","Candidate variance hours","Match status","Recorded decision UTC","Reviewer account ID","Notice"]];
  for(const row of comparison.rows||[]) rows.push(["Plan",row.workerId,row.revisionId,row.plannedStart,row.plannedEnd,row.plannedBreakMinutes,row.plannedHours,row.actual?.start,row.actual?.end,row.actual?.breakMinutes,row.verifiedHours,row.varianceHours,row.matchStatus,row.latestMatch?.createdAt,row.latestMatch?.author,"Candidate variance is diagnostic; confirmations are not payment authorisation"]);
  const candidates=new Set((comparison.rows||[]).map((row:any)=>row.actual?.attendanceId).filter(Boolean));
  for(const actual of comparison.unconfirmedAttendance||[]) if(!candidates.has(actual.attendanceId)) rows.push(["Verified attendance without a unique plan candidate",actual.workerId,"","","","","",actual.start,actual.end,actual.breakMinutes,actual.hours,"","Awaiting a current confirmed plan match","","","Verified attendance is shown once; no payment authorisation"]);
  return "\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n")+"\r\n";
}
