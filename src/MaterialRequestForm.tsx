import React,{useState} from 'react';
import type {User} from './model.ts';
import {SitePhotoPicker,type SitePhoto} from './SitePhotos.tsx';
export function MaterialRequestForm({user,users,send}:{user:User;users:User[];send:(action:string,data:any)=>Promise<void>}) {
  const [photos,setPhotos]=useState<SitePhoto[]>([]),[photoBusy,setPhotoBusy]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  return <form aria-label="Materials request" onChange={()=>setSaved(false)} onSubmit={async e=>{
    e.preventDefault();if(busy||photoBusy)return;
    const form=e.currentTarget,data=Object.fromEntries(new FormData(form));
    setBusy(true);setError('');setSaved(false);
    try {await send('material-request',{...data,photos});form.reset();setPhotos([]);setSaved(true);}
    catch(err){setError((err as Error).message);}finally{setBusy(false);}
  }}>
    <h3>Submit materials request</h3>
    <fieldset disabled={busy || photoBusy}><legend>Requested materials</legend><div className="fields">
      {user.role!=='worker'&&<label>Worker<select aria-label="Worker" name="workerId" required defaultValue=""><option value="">Select worker</option>{users.filter(u=>u.role==='worker').map(u=><option key={u.id} value={u.id}>{u.name} — {u.company}</option>)}</select></label>}
      <label>Priority<select aria-label="Priority" name="priority" defaultValue="normal"><option value="normal">Normal</option><option value="urgent">Urgent — work at risk</option><option value="planned">Planned — future work</option></select></label>
      <label>Description<textarea name="description" maxLength={500} required/></label>
      <label>Specification<input name="specification" maxLength={500} required/></label>
      <label>Quantity<input name="quantity" type="number" step="any" min="0" required/></label>
      <label>Unit<input name="unit" maxLength={30} required/></label>
      <label>Needed by<input name="neededBy" type="date" required/></label>
      <label>Delivery point<input name="deliveryPoint" maxLength={300} required/></label>
      <label>Reason for request<textarea name="reason" maxLength={1000} required/></label>
    </div></fieldset>
    <SitePhotoPicker photos={photos} onChange={p=>{setPhotos(p);setSaved(false);}} disabled={busy} onBusy={setPhotoBusy}/>
    {error&&<p role="alert">{error}</p>}{saved&&<p role="status">Materials request submitted for independent review.</p>}
    <button disabled={busy||photoBusy}>{busy?'Submitting…':'Submit materials request'}</button>
  </form>;
}
