// UTC shift-start reporting; input is the already authorised comparison response.
export function workforcePeriodSummary(comparison:any,period:"day"|"week") {
 const buckets=new Map<string,{period:string;plannedHours:number;verifiedHours:number;confirmedMatches:number;confirmedPlannedHours:number;confirmedVerifiedHours:number}>();
 const key=(iso:string)=>{
  const day=iso.slice(0,10);
  if(period==="day")return day;
  const d=new Date(day+"T00:00:00Z");
  d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
  return d.toISOString().slice(0,10);
 };
 const bucket=(iso:string)=>{
  const k=key(iso);let row=buckets.get(k);
  if(!row){row={period:k,plannedHours:0,verifiedHours:0,confirmedMatches:0,confirmedPlannedHours:0,confirmedVerifiedHours:0};buckets.set(k,row);}
  return row;
 };
 for(const plan of comparison.rows||[]){
  const row=bucket(plan.plannedStart);row.plannedHours+=plan.plannedHours;
  if(plan.confirmed){row.confirmedMatches++;row.confirmedPlannedHours+=plan.plannedHours;}
 }
 const actuals=new Map<string,any>();
 for(const plan of comparison.rows||[])if(plan.actual?.attendanceId)actuals.set(plan.actual.attendanceId,plan.actual);
 for(const actual of comparison.unconfirmedAttendance||[])if(actual.attendanceId)actuals.set(actual.attendanceId,actual);
 for(const actual of actuals.values())bucket(actual.start).verifiedHours+=actual.hours;
 for(const plan of comparison.rows||[])if(plan.confirmed&&plan.actual?.attendanceId)
  bucket(plan.actual.start).confirmedVerifiedHours+=plan.actual.hours;
 return [...buckets.values()].sort((a,b)=>a.period.localeCompare(b.period));
}
