import React from "react";
import type { RecordItem } from "./model.ts";
import { qualityHandoverOverview } from "./quality-intelligence.ts";
import "./quality-intelligence.css";

export function QualityIntelligence({records,mode}:{records:RecordItem[];mode:"quality"|"handover"}) {
  const today=new Date().toISOString().slice(0,10);
  const report=qualityHandoverOverview(records,today);
  return <section className="quality-intelligence" aria-labelledby="quality-overview-heading">
    <div className="quality-overview-heading"><div><p className="eyebrow">CONTROLLED PROJECT EVIDENCE</p><h2 id="quality-overview-heading">{mode==="quality"?"Quality and inspection overview":"Handover readiness overview"}</h2></div><small>Recorded position · {today}</small></div>
    <p>Statuses reflect current records and independent review evidence only. They do not replace site inspections, engineering sign-off or the client's written acceptance.</p>
    <div className="quality-metrics">
      <div><small>Accepted ITP inspections</small><strong>{report.acceptedInspections} / {report.inspections.length}</strong></div>
      <div><small>Open / unaccepted snags</small><strong>{report.outstandingSnags.length}</strong></div>
      <div><small>Overdue open snags</small><strong>{report.overdueSnags.length}</strong></div>
      <div><small>Handover document categories missing</small><strong>{report.missingCategories.length}</strong></div>
      <div><small>Current handover blockers</small><strong>{report.blockers.length}</strong></div>
      <div><small>Client acceptance record</small><strong>{report.handoverAcceptanceRecorded?"Current":"Not current"}</strong></div>
    </div>
    {mode==="quality" ? <>
      <h3>Inspection and snag register</h3>
      {!report.inspections.length&&!report.snags.length?<p>No inspection or snag records saved. Add an ITP and inspection evidence below.</p>:<div className="table-wrap"><table><thead><tr><th>Type</th><th>Item</th><th>Stage / location</th><th>Current review</th><th>Due</th></tr></thead><tbody>
        {[...report.inspections,...report.snags].map(item=><tr key={item.id}><td>{item.kind==="holdpoint"?"ITP":"Snag"}</td><th>{item.title}</th><td>{item.category}</td><td><span className={"quality-status quality-"+item.status}>{item.status}</span></td><td>{item.due||"—"}</td></tr>)}
      </tbody></table></div>}
    </> : <>
      <h3>Required document categories</h3>
      <div className="quality-document-list">{["O&M","as-built","warranty","test-certificate","maintenance"].map(category=>{
        const items=report.handoverItems.filter(r=>r.category===category);
        const accepted=items.some(r=>r.status==="accepted");
        return <div key={category}><strong>{category}</strong><span>{!items.length?"Missing":accepted?"At least one independently accepted record":"Recorded; acceptance pending"}</span></div>;
      })}</div>
      <h3>Recorded stage releases</h3>
      <div className="quality-document-list">{report.releases.map(release=><div key={release.stage}><strong>{release.stage}</strong><span>{release.recorded?"Recorded for current evidence":"Missing or superseded"}</span></div>)}</div>
      <h3>Outstanding handover requirements</h3>
      {report.blockers.length?<ul className="quality-blockers">{report.blockers.map((blocker,i)=><li key={i}>{blocker}</li>)}</ul>:<p>Recorded closeout checks return no blockers. A manager must still obtain and record signed client acceptance.</p>}
    </>}
  </section>;
}
