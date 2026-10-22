/** Indicative labour productivity: verified shift hours vs separately reported, unverified quantities.
 * No payroll approval, quantity certification, or worker performance ranking is inferred.
 */
export type ProductivityRow = {
  workerId: string;
  week: string;
  unit: string;
  reportedQuantity: number;
  verifiedHours: number;
  quantityPerHour: number | null;
  evidenceCount: number;
  warning: string;
};
type ProgressRecord = {kind:string; data:{workerId?:unknown;day?:unknown;unit?:unknown;quantity?:unknown;evidence?:unknown}};
type Shift = {day:unknown;hours:unknown};
type Attendance = {workerId:unknown;shifts?:unknown};
export function weekMonday(day: unknown): string {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error("Invalid work date");
  const date = new Date(day + "T00:00:00Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== day) throw Error("Invalid work date");
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay()+6)%7));
  return date.toISOString().slice(0,10);
}
export function productivityReport(records: ProgressRecord[], attendance: Attendance[]): ProductivityRow[] {
  const hours = new Map<string,number>();
  for (const worker of attendance) {
    if (typeof worker.workerId !== "string" || !Array.isArray(worker.shifts)) continue;
    for (const shift of worker.shifts as Shift[]) {
      const n=Number(shift.hours);
      if (typeof shift.hours !== "number" || !Number.isFinite(n) || n < 0 || n > 24) continue;
      let week: string;
      try { week=weekMonday(shift.day); } catch { continue; }
      const key=JSON.stringify([worker.workerId,week]);
      hours.set(key,(hours.get(key)||0)+n);
    }
  }
  const groups = new Map<string,ProductivityRow>();
  for (const record of records) {
    if (record.kind !== "workforce.progress") continue;
    const {workerId,day,unit,quantity,evidence}=record.data;
    if (typeof workerId !== "string" || !workerId || typeof unit !== "string" || !unit.trim()) continue;
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 0) continue;
    let week: string;
    try { week=weekMonday(day); } catch { continue; }
    const key=JSON.stringify([workerId,week,unit]);
    const row=groups.get(key) || {
      workerId,week,unit,reportedQuantity:0,verifiedHours:hours.get(JSON.stringify([workerId,week]))||0,
      quantityPerHour:null,evidenceCount:0,warning:"Reported quantities are unverified and not certified for payment",
    };
    row.reportedQuantity+=quantity;
    if (typeof evidence==="string" && evidence.trim()) row.evidenceCount++;
    groups.set(key,row);
  }
  return [...groups.values()].map(row=>({
    ...row,
    quantityPerHour:row.verifiedHours>0 ? Math.round(row.reportedQuantity/row.verifiedHours*100)/100 : null,
    warning:row.verifiedHours>0
      ? "Indicative only: reported quantities are unverified; shift hours and quantities may cover different tasks"
      : "No independently verified shift hours for this worker/week; productivity rate unavailable",
  })).sort((a,b)=>b.week.localeCompare(a.week)||a.workerId.localeCompare(b.workerId)||a.unit.localeCompare(b.unit));
}
