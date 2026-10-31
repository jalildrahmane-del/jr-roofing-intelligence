import React, { useState } from "react";
import { SAFETY_DRAFT_LIMIT } from "./risk-authoring.ts";
export function DocumentRevisionEditor({ document, sources, send, close }: {document:any;sources:any[];send:(action:string,data:any)=>Promise<void>;close:()=>void}) {
  const [title,setTitle]=useState(document.data.title),[proposals,setProposals]=useState(document.data.proposals),[limitations,setLimitations]=useState(document.data.limitations);
  const [references,setReferences]=useState<{recordId:string;excerpt:string}[]>(document.data.sources.map((s:any)=>({recordId:s.recordId,excerpt:s.excerpt})));
  const [error,setError]=useState(""),[busy,setBusy]=useState(false);
  const staleSources=references.some(r=>!sources.some(s=>s.id===r.recordId));
  return <section aria-label="Document revision editor">
    <h2>Revise selected document</h2>
    <p>Revising {document.data.title} · revision {document.data.version}. The previous revision and its reviews are retained. This revision needs a new independent review.</p>
    <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try {
      await send("draft",{type:document.data.type,title,proposals,limitations,sources:references,replaces:document.id});close();
    }catch(err){setError((err as Error).message);}finally{setBusy(false);}}}>
      <label>Revised document title<input aria-label="Revised document title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={300} required/></label>
      {references.map((reference,i)=><fieldset key={i}><legend>Source reference {i+1}</legend>
        <label>Current source<select aria-label={`Current source ${i+1}`} value={reference.recordId} required onChange={e=>setReferences(prev=>prev.map((r,n)=>n===i?{...r,recordId:e.target.value}:r))}>
          {!sources.some(s=>s.id===reference.recordId)&&<option value={reference.recordId} disabled>Superseded source — select a current revision</option>}
          {sources.map(s=><option key={s.id} value={s.id}>{s.data.title||s.data.name||s.kind} · {s.id.slice(0,8)}</option>)}
        </select></label>
        <label>Exact source excerpt<textarea aria-label={`Exact source excerpt ${i+1}`} value={reference.excerpt} maxLength={10000} required onChange={e=>setReferences(prev=>prev.map((r,n)=>n===i?{...r,excerpt:e.target.value}:r))}/></label>
      </fieldset>)}
      <label>Revised content<textarea aria-label="Revised content" value={proposals} onChange={e=>setProposals(e.target.value)} maxLength={SAFETY_DRAFT_LIMIT} required/></label>
      <label>Revised gaps and limitations<textarea aria-label="Revised gaps and limitations" value={limitations} onChange={e=>setLimitations(e.target.value)} maxLength={10000} required/></label>
      {error&&<p role="alert">{error}</p>}
      {staleSources&&<p className="warning">Select a current revision for every superseded source before saving.</p>}
      <button disabled={busy||staleSources}>{busy?"Saving…":"Save new document revision"}</button>
      <button className="quiet" type="button" disabled={busy} onClick={close}>Cancel revision</button>
    </form>
  </section>;
}
