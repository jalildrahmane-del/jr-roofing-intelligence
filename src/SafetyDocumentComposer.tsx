import React, { useState } from "react";
import { riskScore, riskBand, formatSafetyDraft, SAFETY_DRAFT_LIMIT } from "./risk-authoring.ts";
import type { RiskRow } from "./risk-authoring.ts";

const emptyRisk = (): RiskRow => ({
  activity: "", hazard: "", persons: "", likelihood: 3, severity: 3,
  controls: "", residualLikelihood: 2, residualSeverity: 3, responsible: "",
});
const scales = [1,2,3,4,5];
function RiskMatrix() {
  return <div className="risk-matrix">
    <table>
      <caption>5 × 5 risk matrix · likelihood × severity</caption>
      <thead><tr><th scope="col"><abbr title="Likelihood">L</abbr> ↓ / <abbr title="Severity">S</abbr> →</th>{scales.map(s=><th scope="col" key={s}>{s}</th>)}</tr></thead>
      <tbody>{[5,4,3,2,1].map(l=><tr key={l}><th scope="row">{l}</th>{scales.map(s=>{
        const score=riskScore(l,s),band=riskBand(score);
        return <td key={s} className={`risk-band-${band.toLowerCase()}`}><strong>{score}</strong><span>{band==="Medium"?<abbr title="Medium">Med</abbr>:band}</span></td>;
      })}</tr>)}</tbody>
    </table>
    <p>Low 1–4 · Medium 5–12 · High 13–25. Ratings are entered by the author and require competent review against the project's risk policy.</p>
  </div>;
}
export function SafetyDocumentComposer({ sources, send }: {
  sources: any[];
  send: (action: string, data: any) => Promise<void>;
}) {
  const [type,setType] = useState<"RAMS"|"CPP">("RAMS");
  const [title,setTitle] = useState("");
  const [sourceId,setSourceId] = useState("");
  const [excerpt,setExcerpt] = useState("");
  const [scope,setScope] = useState("");
  const [method,setMethod] = useState("");
  const [limitations,setLimitations] = useState("");
  const [rows,setRows] = useState<RiskRow[]>([emptyRisk()]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");
  let preview = "", previewError = "";
  const complete = scope.trim() && method.trim() && rows.every(r=>
    [r.activity,r.hazard,r.persons,r.controls,r.responsible].every(v=>v.trim()));
  if (complete) {
    try { preview = formatSafetyDraft(type,scope,method,rows); }
    catch (err) { previewError = (err as Error).message; }
  }
  const update = (index: number, patch: Partial<RiskRow>) =>
    setRows(previous => previous.map((r,i) => i === index ? {...r,...patch} : r));
  return (
    <section className="safety-composer">
      <h2>Structured RAMS / CPP authoring</h2>
      <p>Record a site-specific method and each hazard with initial and residual risk ratings. All fields are entered by the author; the application does not determine that work is safe.</p>
      <form onSubmit={async e => {
        e.preventDefault();setBusy(true);setError("");setSuccess("");
        try {
          const proposals = formatSafetyDraft(type,scope,method,rows);
          await send("draft",{type,title,sources:[{recordId:sourceId,excerpt}],proposals,limitations});
          setSuccess("Source-linked draft saved. Independent manager review and PDF verification are still required.");
        } catch(err) {setError((err as Error).message)}
        finally {setBusy(false)}
      }}>
        <div className="fields">
          <label>Document type<select value={type} onChange={e=>setType(e.target.value as "RAMS"|"CPP")}><option>RAMS</option><option>CPP</option></select></label>
          <label>Document title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={300} required /></label>
          <label>Current source record<select value={sourceId} onChange={e=>setSourceId(e.target.value)} required><option value="">Select a registered source</option>{sources.map((s:any)=><option key={s.id} value={s.id}>{s.data.title || s.data.name || s.kind} · {s.id.slice(0,8)}</option>)}</select></label>
          <label>Exact excerpt from selected source<textarea aria-label="Exact excerpt from selected source" value={excerpt} onChange={e=>setExcerpt(e.target.value)} maxLength={10000} required /></label>
        </div>
        <label>Project / work scope<textarea aria-label="Project / work scope" value={scope} onChange={e=>setScope(e.target.value)} maxLength={5000} required /></label>
        <label>{type==="RAMS"?"Work sequence / safe method":"Site arrangements, sequence, welfare, logistics, emergency and coordination"}<textarea aria-label={type==="RAMS"?"Work sequence / safe method":"Site arrangements, sequence, welfare, logistics, emergency and coordination"} value={method} onChange={e=>setMethod(e.target.value)} maxLength={12000} required /></label>
        <h3>Activity risk assessment · 5 × 5</h3>
        <RiskMatrix />
        <p>Enter actual site controls. A low residual score does not itself authorise work. Add independent checks for work at height, roof fragility, lifting, hot works and temporary works where applicable.</p>
        {rows.map((r,i)=>(
          <fieldset className="risk-entry" key={i}>
            <legend>Activity {i+1}</legend>
            <div className="fields">
              {([
                ["activity","Task / activity"],["hazard","Hazard and potential harm"],
                ["persons","Persons exposed"],["responsible","Responsible person"],
              ] as const).map(([key,label])=><label key={key}>{label}<input value={r[key]} onChange={e=>update(i,{[key]:e.target.value})} maxLength={2000} required /></label>)}
            </div>
            <div className="risk-ratings">
              {([
                ["likelihood","Initial likelihood"],["severity","Initial severity"],
                ["residualLikelihood","Residual likelihood"],["residualSeverity","Residual severity"],
              ] as const).map(([key,label])=><label key={key}>{label}<select aria-label={label} value={r[key]} onChange={e=>update(i,{[key]:Number(e.target.value)})}>{scales.map(v=><option key={v} value={v}>{v}</option>)}</select></label>)}
            </div>
            <label>Controls / safe system of work<textarea aria-label="Controls / safe system of work" value={r.controls} onChange={e=>update(i,{controls:e.target.value})} maxLength={2000} required /></label>
            <p className="risk-score" aria-live="polite">Initial: <strong className={`risk-band-${riskBand(riskScore(r.likelihood,r.severity)).toLowerCase()}`}>{riskScore(r.likelihood,r.severity)} · {riskBand(riskScore(r.likelihood,r.severity))}</strong> | Residual (author assessment): <strong className={`risk-band-${riskBand(riskScore(r.residualLikelihood,r.residualSeverity)).toLowerCase()}`}>{riskScore(r.residualLikelihood,r.residualSeverity)} · {riskBand(riskScore(r.residualLikelihood,r.residualSeverity))}</strong></p>
            {rows.length>1&&<button type="button" className="quiet" onClick={()=>setRows(prev=>prev.filter((_,n)=>n!==i))}>Remove activity</button>}
          </fieldset>
        ))}
        <button type="button" className="quiet" disabled={rows.length>=25} onClick={()=>setRows(prev=>[...prev,emptyRisk()])}>+ Add activity / hazard</button>
        <label>Outstanding information, exclusions, assumptions and evidence gaps<textarea aria-label="Outstanding information, exclusions, assumptions and evidence gaps" value={limitations} onChange={e=>setLimitations(e.target.value)} maxLength={10000} required /></label>
        {preview&&<details className="safety-draft-preview"><summary>Read formatted draft before saving</summary><p>{preview.length.toLocaleString("en-GB")} / {SAFETY_DRAFT_LIMIT.toLocaleString("en-GB")} characters · source evidence and gaps are stored separately and included in the review PDF.</p><pre>{preview}</pre></details>}
        {previewError&&<p role="alert" className="error">{previewError}</p>}
        {error&&<p role="alert" className="error">{error}</p>}
        {success&&<p role="status" className="success">{success}</p>}
        <button type="submit" disabled={busy||!sources.length||!!previewError}>{busy?"Saving…":"Save source-linked draft for independent review"}</button>
        {!sources.length&&<p className="warning">Register a project source first to create a traceable draft.</p>}
      </form>
    </section>
  );
}
