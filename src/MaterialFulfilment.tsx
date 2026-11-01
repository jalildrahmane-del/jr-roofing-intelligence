import React, {useState} from 'react';
import type {User,RecordItem} from './model.ts';
import {materialFulfilment} from './material-fulfilment.ts';
import {workforcePersonName} from './workforce-people.ts';
type Props = {state:any;user:User;send:(action:string,data:any)=>Promise<void>};
function MaterialCard({request,state,user,send}:Props & {request:RecordItem}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
  const f=materialFulfilment(state.records,request);
  const receive=['manager','supervisor'].includes(user.role);
  const submit=(action:string)=>async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(busy)return;
    const form=e.currentTarget,data=Object.fromEntries(new FormData(form));
    setBusy(true);setError('');setSaved('');
    try {
      await send(action,{...data,requestId:request.id,previousId:f.latestId,attest:data.attest==='on'});
      form.reset();setSaved(action==='material-order'?'Order recorded.':'Delivery receipt recorded.');
    } catch(err){setError((err as Error).message);}finally{setBusy(false);}
  };
  const quantity=(value:number)=>value.toLocaleString('en-GB',{maximumSignificantDigits:12});
  return <article aria-label={`Materials: ${request.data.description}`}>
    <h3>{request.data.description}</h3>
    <p>{workforcePersonName(state,request.data.workerId)} · {request.data.specification}</p>
    <p><strong>{f.status}</strong> · requested {quantity(request.data.quantity)} {request.data.unit} · needed {request.data.neededBy}</p>
    <p>Delivery point: {request.data.deliveryPoint}</p>
    {f.order && <>
      <p>Supplier: {f.order.data.supplier} · order {f.order.data.orderReference} · expected {f.order.data.expectedDate}</p>
      <p>Accepted: {quantity(f.received)} {request.data.unit} · outstanding: {quantity(f.remaining)} {request.data.unit} · damaged/rejected across deliveries: {quantity(f.damaged)} {request.data.unit}</p>
      <details><summary>Order and receipt history</summary>
        <p>Order recorded {new Date(f.order.createdAt).toLocaleString()} · evidence: {f.order.data.evidence}</p>
        {f.deliveries.length===0?<p>No delivery receipts recorded.</p>:<ul>{f.deliveries.map(r=><li key={r.id}>
          {r.data.deliveredOn} · delivery note {r.data.deliveryReference} · accepted {quantity(r.data.acceptedQuantity)} {request.data.unit} · damaged/rejected {quantity(r.data.damagedQuantity)} {request.data.unit}
          <p>{r.data.notes} · recorded {new Date(r.createdAt).toLocaleString()}</p>
        </li>)}</ul>}
      </details>
    </>}
    {user.role==='manager' && f.review?.data.decision==='approved' && !f.order && <form onSubmit={submit('material-order')} onChange={()=>setSaved('')}>
      <h4>Record placed order</h4><p>Record an order already placed with the supplier. This does not send an order or make a payment.</p>
      <fieldset disabled={busy}><legend>Order details</legend><div className="fields">
        <label>Supplier<input name="supplier" maxLength={300} required/></label>
        <label>Order reference<input name="orderReference" maxLength={200} required/></label>
        <label>Expected delivery date<input name="expectedDate" type="date" required/></label>
        <label>Order evidence reference<input name="evidence" maxLength={1000} required/></label>
      </div><label><input name="attest" type="checkbox" required/>I confirm this order has been placed for the full approved quantity.</label></fieldset>
      <button disabled={busy}>{busy?'Saving…':'Record placed order'}</button>
    </form>}
    {receive && f.order && f.remaining>0 && <form key={f.latestId} onSubmit={submit('material-delivery')} onChange={()=>setSaved('')}>
      <h4>Record delivery receipt</h4><p>Record this delivery only. Damaged or rejected quantities remain outstanding until accepted replacements arrive.</p>
      <fieldset disabled={busy}><legend>Receipt details</legend><div className="fields">
        <label>Delivery date<input name="deliveredOn" type="date" required max={new Date().toISOString().slice(0,10)}/></label>
        <label>Delivery note reference<input name="deliveryReference" maxLength={200} required/></label>
        <label>Accepted quantity ({request.data.unit})<input name="acceptedQuantity" type="number" step="any" min="0" max={f.remaining} required/></label>
        <label>Damaged or rejected quantity ({request.data.unit})<input name="damagedQuantity" type="number" step="any" min="0" max={f.remaining} defaultValue="0" required/></label>
        <label>Receipt and condition notes<textarea name="notes" maxLength={2000} required/></label>
      </div><label><input name="attest" type="checkbox" required/>I checked these quantities and their condition against the delivery note.</label></fieldset>
      <button disabled={busy}>{busy?'Saving…':'Record delivery receipt'}</button>
    </form>}
    {error&&<p role="alert">{error}</p>}{saved&&<p role="status">{saved}</p>}
  </article>;
}
export function MaterialFulfilment(props:Props){
  const requests:RecordItem[]=props.state.records.filter((r:RecordItem)=>r.kind==='workforce.material-request');
  return <section aria-label="Materials orders and receipts"><h2>Materials orders and receipts</h2>
    {!requests.length?<p>No materials requests recorded yet.</p>:requests.map(request=><MaterialCard key={request.id} {...props} request={request}/>)}
  </section>;
}
