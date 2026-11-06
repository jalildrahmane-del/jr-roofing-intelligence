import React,{useState} from 'react';
import type {WorkforceAction} from './workforce-actions.ts';
export function WorkforceActions({actions,checkedAt,refresh,open}:{actions:WorkforceAction[];checkedAt:string;refresh:()=>Promise<void>;open:(action:WorkforceAction)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[filter,setFilter]=useState('all');
 const filtered=actions.filter(a=>filter==='all'||(filter==='urgent'?(a.urgent||a.overdue):a.kind===filter));
 return <section className="workforce-actions" aria-labelledby="workforce-actions-heading">
  <h2 id="workforce-actions-heading">Site action centre</h2>
  <p>{actions.length} outstanding items in your authorised project records. Items update when the page refreshes or you save a change.</p>
  <p><small>Last checked {new Date(checkedAt).toLocaleString('en-GB')}. Due dates are compared with today's UK date.</small></p>
  <label>Show actions<select aria-label="Show actions" value={filter} onChange={e=>setFilter(e.target.value)}>
   <option value="all">All outstanding items</option><option value="urgent">Urgent or overdue</option><option value="review">Reviews I can perform</option><option value="order">Orders to record</option><option value="delivery">Deliveries to check</option><option value="returned">Returned reports to revise</option><option value="waiting">Awaiting someone else</option>
  </select></label>
  <button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await refresh();}catch(e){setError('Could not refresh actions. The list still shows the last successful check. '+(e as Error).message);}finally{setBusy(false);}}}>{busy?'Refreshing actions…':'Refresh site actions'}</button>
  {error&&<p role="alert">{error}</p>}
  {!filtered.length?<p role="status">{actions.length?'No outstanding items match this filter.':'No outstanding site actions in the loaded records.'}</p>:<ul>{filtered.map(a=><li key={a.id} data-record-id={a.recordId}>
   <strong>{a.overdue?'Overdue · ':a.urgent?'Urgent · ':''}{a.title}</strong><p>{a.detail}</p>
   <button type="button" className="quiet" onClick={()=>open(a)}>Open item</button>
  </li>)}</ul>}
 </section>;
}
