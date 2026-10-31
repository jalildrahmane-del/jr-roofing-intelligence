// Input must be the already-authorised workforce API report, never raw records.
export function attendanceCsv(report: any[]): string {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
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
    "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n"
  );
}
