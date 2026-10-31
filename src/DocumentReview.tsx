import React, { useState } from "react";
import { DOCUMENT_CHECKLIST_VERSION, reviewChecklistComplete } from "./document-review.ts";
export function DocumentReview({pid,documents,send}:{pid:string;documents:any[];send:(action:string,data:any)=>Promise<void>}) {
  const [selected,setSelected]=useState<any>(null),[checks,setChecks]=useState<Record<string,boolean>>({}),[decision,setDecision]=useState("accepted"),[note,setNote]=useState(""),[attest,setAttest]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const eligible=documents.filter(doc=>doc.canReview);
  const complete=selected&&reviewChecklistComplete(selected.data.type,DOCUMENT_CHECKLIST_VERSION,checks);
  return <section className="document-review">
    <form onSubmit={async e=>{
      e.preventDefault();if(!selected)return;
      setBusy(true);setError("");setMessage("");
      try{
        await send("review",{documentId:selected.id,decision,note,attest,checklistVersion:DOCUMENT_CHECKLIST_VERSION,checks,previousReviewId:selected.reviewHistory.at(-1)?.id??null});
        setMessage("Independent document review recorded.");setSelected(null);setChecks({});setAttest(false);setNote("");
      }catch(err){setError((err as Error).message);}finally{setBusy(false);}
    }}>
      <h2>Record independent document review</h2>
      <p>Review the complete PDF and cited evidence. Confirm each item yourself. Rejection can record incomplete checks with a reason. A document review does not grant engineering approval or permission to work.</p>
      <label>Document to review<select aria-label="Document to review" value={selected?.id||""} required disabled={busy} onChange={e=>{
        setSelected(eligible.find(doc=>doc.id===e.target.value)||null);setChecks({});setDecision("accepted");setNote("");setAttest(false);setError("");setMessage("");
      }}><option value="">Select a current document by another author</option>{eligible.map(doc=><option key={doc.id} value={doc.id}>{doc.data.title} · revision {doc.data.version}</option>)}</select></label>
      {!eligible.length&&<p>No current documents by another author are available for review.</p>}
      {selected&&<>
        <p><a href={`/api/document-pdf?pid=${encodeURIComponent(pid)}&id=${encodeURIComponent(selected.id)}`}>Open selected review PDF</a></p>
        <fieldset disabled={busy}><legend>Document review checklist · version {DOCUMENT_CHECKLIST_VERSION}</legend>
          {selected.reviewItems.map((item:any)=><label className="review-check" key={item.id}><input type="checkbox" checked={checks[item.id]===true} onChange={e=>setChecks(prev=>({...prev,[item.id]:e.target.checked}))}/><span>{item.label}</span></label>)}
        </fieldset>
        <p role="status">{selected.reviewItems.filter((item:any)=>checks[item.id]===true).length} / {selected.reviewItems.length} checks confirmed</p>
        <label>Review decision<select aria-label="Review decision" value={decision} disabled={busy} onChange={e=>setDecision(e.target.value)}><option value="accepted">Accept for document issue</option><option value="rejected">Reject — revision required</option></select></label>
        <label>Review note<textarea aria-label="Review note" value={note} onChange={e=>setNote(e.target.value)} maxLength={5000} required disabled={busy}/></label>
        <label className="review-check"><input type="checkbox" checked={attest} required disabled={busy} onChange={e=>setAttest(e.target.checked)}/><span>I reviewed the complete PDF, source evidence and limitations</span></label>
        <button disabled={busy||!attest||(decision==="accepted"&&!complete)}>{busy?"Recording…":"Record review decision"}</button>
      </>}
      {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    </form>
  </section>;
}
