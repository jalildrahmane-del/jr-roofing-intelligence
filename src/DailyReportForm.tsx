import {returnedDailyReports,retainedDailyPhotoIds} from "./daily-report-revisions.ts";
import { prepareSitePhoto } from "./site-photo.ts";
import React, { useEffect, useState } from 'react';
import { api } from './api.ts';
import type { User,RecordItem } from './model.ts';
import { dailyDraftKey, readDailyDraft } from './daily-report-draft.ts';
export function DailyReportForm({pid, user, users, refresh, records}: {
  pid: string; user: User; users: User[]; records:RecordItem[]; refresh: () => Promise<void>;
}) {
  const key = dailyDraftKey(user.id, pid);
  const [initial] = useState(() => {
    try { return {draft: readDailyDraft(localStorage.getItem(key)), error: ''}; }
    catch { return {draft: null, error: 'Saved draft could not be read. It has been preserved. Discard it explicitly to start again.'}; }
  });
  const blank = () => ({day: new Date().toLocaleDateString('en-CA')});
  const [fields, setFields] = useState<Record<string,string>>(initial.draft?.fields || blank());
  const eligible=returnedDailyReports(records,user.id);
  const original=records.find(r=>r.id===fields.replacesReportId&&r.kind==='workforce.daily-report');
  const retainedIds=retainedDailyPhotoIds(fields.retainedPhotoIds);
  const retained=(original?.data.evidence || []).filter((p:any)=>retainedIds.includes(p.assetId));
  const stale=Boolean(fields.replacesReportId&&!eligible.some(r=>r.id===fields.replacesReportId));
  const [photos, setPhotos] = useState(initial.draft?.photos || []);
  const [blocked, setBlocked] = useState(Boolean(initial.error));
  const [error, setError] = useState(initial.error);
  const [message, setMessage] = useState(initial.draft ? 'Saved draft restored on this device. Not submitted.' : '');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const changed = () => { setDirty(true); setMessage('Changes are not saved yet.'); };
  const save = () => {
    setError('');
    try {
      const draft = {version: 1, savedAt: new Date().toISOString(), fields, photos};
      localStorage.setItem(key, JSON.stringify(draft));
      setDirty(false); setMessage('Draft saved on this device, including photographs. Not submitted.');
    } catch { setError('Draft could not be saved: device storage is full or unavailable. Your changes remain on this page; keep it open and try again or submit when online.'); }
  };
  const discard = () => {
    if (!window.confirm('Discard this daily-report draft and its photographs from this device?')) return;
    try {
      localStorage.removeItem(key); setFields(blank()); setPhotos([]); setDirty(false); setBlocked(false);
      setError(''); setMessage('Draft discarded.');
    } catch { setError('The saved draft could not be removed from this device.'); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || photoBusy || blocked || stale) return;
    setError(''); setMessage('');
    if (!photos.length && !retained.length) { setError('Add at least one site photograph.'); return; }
    setBusy(true);
    try {
      // Only an acknowledged POST clears the editor. A failed refresh is not a failed submission.
      await api('workforce', {pid, action:'daily-report', data:{...fields, operatives:Number(fields.operatives), photos,retainedPhotoIds:retainedIds}});
      setFields(blank()); setPhotos([]); setDirty(false);
      setMessage('Daily report and photographs submitted for supervisor review.');
      try { localStorage.removeItem(key); }
      catch { setBlocked(true); setError('Report submitted, but the saved device draft could not be removed. Discard it before writing another report; do not submit it again.'); }
      try { await refresh(); }
      catch { setError('Report submitted successfully. The report list could not refresh; reload when online.'); }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const input = (name: string, label: string, type = 'textarea', maxLength = 2000) => <label key={name}>{label}
    {type === 'textarea' ? <textarea aria-label={label} name={name} value={fields[name] || ''} maxLength={maxLength} required onChange={e => {setFields(v => ({...v,[name]:e.target.value})); changed();}} /> :
      <input readOnly={Boolean(fields.replacesReportId)&&name==='day'} aria-label={label} name={name} type={type} value={fields[name] || ''} required min={type === 'number' ? 1 : undefined} max={type === 'number' ? 10000 : undefined} step={type === 'number' ? 1 : undefined} onChange={e => {setFields(v => ({...v,[name]:e.target.value})); changed();}} />}
  </label>;
  return <form aria-label="Daily site report" onSubmit={submit}>
    <p>Save an unfinished report here, even offline while this page is open. Drafts and photographs stay in this browser for your account and this project; they do not sync to another device. Use Save draft before leaving. Clearing browser data removes drafts.</p>
    {stale && <p role="alert">This saved revision is no longer available for resubmission. Your draft is preserved. Check the submitted reports, then discard this draft when ready.</p>}
    <fieldset disabled={busy || photoBusy || blocked}>
      <label>Revise returned report<select aria-label="Revise returned report" name="replacesReportId" value={fields.replacesReportId || ''} onChange={e=>{
        const id=e.target.value;
        if((dirty||photos.length||Object.entries(fields).some(([name,value])=>name!=='day'&&Boolean(value)))&&!window.confirm('Replace the current editor with the selected report? This account keeps one draft per project.'))return;
        if(!id){setFields(blank());setPhotos([]);changed();return;}
        const r=eligible.find(r=>r.id===id);if(!r)return;
        const values:Record<string,string>={replacesReportId:r.id,retainedPhotoIds:JSON.stringify(r.data.evidence.map((p:any)=>p.assetId))};
        for(const name of ['workerId','day','operatives','workAreas','conditions','completed','delays','nextShift']) values[name]=String(r.data[name]??'');
        setFields(values);setPhotos([]);setError('');changed();
      }}><option value="">New daily report</option>{eligible.map(r=><option key={r.id} value={r.id}>{r.data.day} · {r.data.completed.slice(0,80)}</option>)}{stale&&<option value={fields.replacesReportId}>Saved revision — no longer eligible</option>}</select></label>
      {original&&<p>Revising report for {original.data.day}. Review notes: {records.filter(r=>r.kind==='workforce.daily-review'&&r.data.reportId===original.id).at(-1)?.data.reason}. The original report and review remain in the history.</p>}

      <legend>Report details</legend>
      <div className="fields">
        {user.role !== 'worker' && <label>Worker<select aria-label="Worker" disabled={Boolean(fields.replacesReportId)} name="workerId" required value={fields.workerId || ''} onChange={e => {setFields(v=>({...v,workerId:e.target.value}));changed();}}><option value="">Select worker</option>{users.filter(u=>u.role==='worker').map(u=><option key={u.id} value={u.id}>{u.name} — {u.company}</option>)}</select></label>}
        {input('day','Work date','date')}
        {input('operatives','Number of operatives','number')}
        {input('workAreas','Work areas','textarea',1000)}
        {input('conditions','Site conditions (weather and access)')}
        {input('completed','Works completed','textarea',3000)}
        {input('delays',"Delays or restrictions (write 'None' if applicable)")}
        {input('nextShift','Plan for next shift')}
      </div>
      <label>Site photographs (1–4)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={async e => {
        const element=e.currentTarget, files=Array.from(element.files || []);
        if (!files.length) return;
        setPhotoBusy(true); setError('');
        try {
          if (files.length+photos.length+retained.length>4) throw Error('Maximum four photographs per report');
          const added=await Promise.all(files.map(async file=>({image:await prepareSitePhoto(file),caption:file.name.slice(0,300)||'Site photograph'})));
          setPhotos(v=>[...v,...added]);changed();
        } catch(e) {setError((e as Error).message);}
        finally {setPhotoBusy(false);element.value='';}
      }} /></label>
      {retained.length>0&&<div className="workforce-photo-grid" aria-label="Retained original photographs">{retained.map((photo:any)=><figure key={photo.assetId}>
        <img src={'/api/evidence/'+photo.assetId} alt={photo.caption}/><figcaption>{photo.caption}</figcaption>
        <button type="button" onClick={()=>{setFields(v=>({...v,retainedPhotoIds:JSON.stringify(retainedIds.filter(id=>id!==photo.assetId))}));changed();}}>Remove retained photograph: {photo.caption}</button>
      </figure>)}</div>}
      <div className="workforce-photo-grid">{photos.map((photo,i)=><div key={i}>
        <img src={photo.image} alt={`Photo ${i+1} preview`} />
        <label>Photo {i+1} caption<input value={photo.caption} required maxLength={300} onChange={e=>{setPhotos(v=>v.map((p,n)=>n===i?{...p,caption:e.target.value}:p));changed();}} /></label>
        <button type="button" className="quiet" onClick={()=>{setPhotos(v=>v.filter((_,n)=>n!==i));changed();}}>Remove photo</button>
      </div>)}</div>
      <button type="button" onClick={save}>Save draft on this device</button>
      <button type="submit" disabled={stale||(!photos.length&&!retained.length)}>{busy?'Submitting…':'Submit daily report'}</button>
    </fieldset>
    <button type="button" className="quiet" disabled={busy || photoBusy} onClick={discard}>Discard draft</button>
    {photoBusy && <p role="status">Preparing photographs…</p>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </form>;
}
