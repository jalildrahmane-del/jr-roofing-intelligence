import React, { useState } from "react";
import type { User } from "./model.ts";
import { plannedActualCsv } from "./workforce-csv.ts";
function MatchReview({row,send}:{row:any;send:(action:string,data:any)=>Promise<void>}){
  const [decision,setDecision]=useState("confirmed"),[reason,setReason]=useState(""),[attest,setAttest]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  return <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{
    await send("match",{planRevisionId:row.revisionId,inputFingerprint:row.inputFingerprint,previousMatchId:row.latestMatch?.id??null,decision,reason,attest});
  }catch(err){setError((err as Error).message);}finally{setBusy(false);}}}>
    <label>Shift match decision<select aria-label="Shift match decision" value={decision} disabled={busy} onChange={e=>setDecision(e.target.value)}><option value="confirmed">Confirm plan-to-attendance match</option><option value="rejected">Reject proposed match</option></select></label>
    <label>Match evidence and reason<textarea aria-label="Match evidence and reason" value={reason} disabled={busy} maxLength={2000} required onChange={e=>setReason(e.target.value)}/></label>
    <label className="match-attestation"><input type="checkbox" checked={attest} disabled={busy} onChange={e=>setAttest(e.target.checked)} required/><span>I checked this plan revision against the independently verified attendance and recorded breaks.</span></label>
    {error&&<p role="alert">{error}</p>}
    <button disabled={busy||!attest}>{busy?"Recording…":"Record shift match"}</button>
  </form>;
}
export function WorkforceComparison({state,user,send}:{state:any;user:User;send:(action:string,data:any)=>Promise<void>}) {
  const comparison=state.comparison;if(!comparison)return null;
  const editable=["manager","supervisor"].includes(user.role);
  const time=(value:string)=>value?value.replace("T"," ").slice(0,16)+" UTC":"Not available";
  const hours=(value:any)=>typeof value==="number"?value.toFixed(2):"Not matched";
  const reviewer=(id:string)=>id===user.id?user.name:state.users.find((u:any)=>u.id===id)?.name||id;
  return <section className="workforce-comparison" aria-label="Planned versus actual workforce report">
    <h2>Planned versus verified attendance</h2>
    <p>All saved active plans and completed verified attendance for this project. Plans and overlap suggestions never create verified hours. A missing match does not establish an absence.</p>
    <dl className="comparison-totals">
      <div><dt>Planned net hours</dt><dd>{hours(comparison.totals.plannedHours)}</dd></div>
      <div><dt>Verified net hours</dt><dd>{hours(comparison.totals.verifiedHours)}</dd></div>
      <div><dt>Confirmed matches</dt><dd>{comparison.totals.confirmedMatches}</dd></div>
      <div><dt>Planned hours in confirmed matches</dt><dd>{hours(comparison.totals.confirmedPlannedHours)}</dd></div>
      <div><dt>Verified hours in confirmed matches</dt><dd>{hours(comparison.totals.confirmedVerifiedHours)}</dd></div>
      <div><dt>Variance for confirmed matches</dt><dd>{hours(comparison.totals.confirmedVarianceHours)}</dd></div>
    </dl>
    {!comparison.rows.length&&<p>No active shift plans to compare.</p>}
    {comparison.rows.map((row:any)=><article key={row.revisionId} aria-label="Shift comparison">
      <h3>{state.users.find((u:any)=>u.id===row.workerId)?.name||row.workerId}</h3>
      <p><strong>{row.matchStatus}</strong></p>
      <p>Plan: {time(row.plannedStart)} → {time(row.plannedEnd)} · {row.plannedBreakMinutes} break minutes · {hours(row.plannedHours)} net hours</p>
      <p>Verified attendance: {row.actual?`${time(row.actual.start)} → ${time(row.actual.end)} · ${row.actual.breakMinutes} break minutes · ${hours(row.verifiedHours)} net hours`:"No unique completed match. Review attendance and plans."}</p>
      <p>Candidate variance: {hours(row.varianceHours)} hours · {row.notice}</p>
      {row.latestMatch&&<p>Last recorded decision: {row.latestMatch.data.decision} · {row.latestMatch.createdAt} · reviewer {reviewer(row.latestMatch.author)} · {row.latestMatch.data.reason}</p>}
      {editable&&row.actual&&<MatchReview key={row.inputFingerprint+":"+(row.latestMatch?.id||"")} row={row} send={send}/>}
    </article>)}
    <h3>Verified attendance awaiting a current confirmed plan match</h3>
    <p>These are already included in verified net hours above. A suggested overlap remains here until confirmed; do not add these hours again.</p>
    <ul>{comparison.unconfirmedAttendance.map((a:any)=><li key={a.attendanceId}>{a.workerId} · {time(a.start)} → {time(a.end)} · {hours(a.hours)} verified hours</li>)}</ul>
    <details><summary>Recorded shift match history</summary><ul>{state.records.filter((r:any)=>r.kind==="workforce.match").map((r:any)=><li key={r.id}>{r.data.workerId} · {r.createdAt} · reviewer {reviewer(r.author)} · {r.data.decision} · {r.data.reason}</li>)}</ul></details>
    <button type="button" onClick={()=>{const url=URL.createObjectURL(new Blob([plannedActualCsv(comparison)],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="workforce-planned-versus-actual.csv";a.click();URL.revokeObjectURL(url);}}>Download planned versus actual CSV</button>
    <p>{comparison.notice}</p>
  </section>;
}
