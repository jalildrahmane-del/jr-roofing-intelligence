import React,{useState} from "react";
import type {RecordItem,User} from "./model.ts";
import {api} from "./api.ts";
import {commercialSummary,formatGBP} from "./commercial-control.ts";
import "./CommercialControl.css";
export function CommercialControl({pid,records,user,refresh}:{pid:string;records:RecordItem[];user:User;refresh:()=>Promise<void>}) {
  const [error,setError]=useState(""),[busy,setBusy]=useState(false);
  const summary=commercialSummary(records);
  const save=async(action:string,form:HTMLFormElement)=>{
    setBusy(true);setError("");
    try {
      const data=Object.fromEntries(new FormData(form));
      const amount=String(data.amountGBP||"").trim();
      if(!/^\d+(\.\d{1,2})?$/.test(amount))throw Error("Enter a non-negative amount with up to two decimal places");
      const [pounds,pennies=""]=amount.split(".");
      const amountPence=Number(pounds)*100+Number(pennies.padEnd(2,"0"));
      if(!Number.isSafeInteger(amountPence))throw Error("Amount exceeds supported range");
      delete data.amountGBP;
      await api("commercial",{pid,action,data:{...data,amountPence}});
      await refresh();form.reset();
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  };
  const form=(action:string,fields:React.ReactNode,button:string)=><form onSubmit={e=>{e.preventDefault();void save(action,e.currentTarget)}}>
    <div className="fields">{fields}</div><button disabled={busy}>{busy?"Saving…":button}</button>
  </form>;
  if(!pid)return <section><p>Select or create a project to manage its commercial records.</p></section>;
  return <section className="commercial-control">
    <p className="warning">Financial working register. Entries are human-recorded; approval references are not independently verified. This is not a final account, cost-to-complete forecast or payment certificate.</p>
    <div className="commercial-summary">
      <div><small>Recorded baseline budget</small><strong>{formatGBP(summary.approvedBudgetPence)}</strong></div>
      <div><small>Recorded commitments</small><strong>{formatGBP(summary.committedPence)}</strong></div>
      <div><small>Recorded actual costs</small><strong>{formatGBP(summary.actualPence)}</strong></div>
      <div><small>Proposed variations</small><strong>{formatGBP(summary.pendingVariationsPence)}</strong></div>
      <div><small>Accepted variation records</small><strong>{formatGBP(summary.acceptedVariationsPence)}</strong></div>
    </div>
    <p>Committed and actual costs may overlap, so they are shown separately. A reliable forecast requires outstanding commitments, accruals and remaining-work estimates.</p>
    {(summary.unpricedCommitments>0||summary.unpricedVariations>0)&&<p className="warning">{summary.unpricedCommitments} unpriced commitments and {summary.unpricedVariations} unpriced variations need attention.</p>}
    <h2>Variation register</h2>
    {!summary.variations.length?<p>No variations recorded yet.</p>:<div className="table-wrap"><table><thead><tr><th>Reference</th><th>Description</th><th>Amount</th><th>Recorded status</th><th>Recorded at</th></tr></thead><tbody>
      {summary.variations.map(v=><tr key={v.id}><td>{v.reference}</td><td>{v.description}</td><td>{formatGBP(v.amountPence)}</td><td>{v.status}</td><td>{new Date(v.createdAt).toLocaleDateString("en-GB")}</td></tr>)}
    </tbody></table></div>}
    {user.role==="manager"&&<>
      {error&&<p role="alert" className="error">{error}</p>}
      <h2>Record budget</h2>
      {form("budget",<><label>Budget amount (£)<input name="amountGBP" inputMode="decimal" required/></label><label>Approval reference<input name="reference" required maxLength={300}/></label><label>Basis / exclusions<textarea name="note" required maxLength={2000}/></label></>,"Record baseline budget")}
      <h2>Record cost or commitment</h2>
      {form("cost",<><label>Type<select name="costType"><option value="commitment">Purchase order / commitment</option><option value="actual">Actual cost</option></select></label><label>Amount (£)<input name="amountGBP" inputMode="decimal" required/></label><label>Order / invoice reference<input name="reference" required maxLength={300}/></label><label>Description<textarea name="description" required maxLength={2000}/></label></>,"Record cost")}
      <h2>Record variation or status revision</h2>
      {form("variation",<><label>Revise existing variation<select name="entityId"><option value="">New variation</option>{summary.variations.map(v=><option key={v.id} value={v.id}>{v.reference} · {v.status}</option>)}</select></label><label>Reference<input name="reference" required maxLength={200}/></label><label>Description<textarea name="description" required maxLength={2000}/></label><label>Amount (£)<input name="amountGBP" inputMode="decimal" required/></label><label>Status<select name="status"><option value="proposed">Proposed</option><option value="accepted">Accepted (reference required)</option><option value="rejected">Rejected (reference required)</option></select></label><label>Client decision reference (for accepted/rejected)<input name="decisionReference" maxLength={500}/></label></>,"Save variation record")}
    </>}
  </section>;
}
