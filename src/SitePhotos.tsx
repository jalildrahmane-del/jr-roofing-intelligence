import React, {useState} from 'react';
import {prepareSitePhoto} from './site-photo.ts';
export type SitePhoto = {image:string;caption:string};
export function SitePhotoPicker({photos,onChange,disabled,onBusy}:{photos:SitePhoto[];onChange:(p:SitePhoto[])=>void;disabled:boolean;onBusy:(busy:boolean)=>void}) {
  const [error,setError]=useState(''),[processing,setProcessing]=useState(false);
  return <div>
    <label>Evidence photographs (optional, maximum 4)<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || processing} onChange={async e=>{
      const input=e.currentTarget,files=Array.from(input.files || []);if(!files.length)return;
      setError('');setProcessing(true);onBusy(true);
      try {
        if(photos.length+files.length>4)throw Error('Maximum four photographs per record');
        const added=await Promise.all(files.map(async f=>({image:await prepareSitePhoto(f),caption:f.name.slice(0,300)||'Site photograph'})));
        onChange([...photos,...added]);
      }catch(err){setError((err as Error).message);}finally{input.value='';setProcessing(false);onBusy(false);}
    }}/></label>
    {processing && <p role="status">Preparing photographs…</p>}
    <div className="workforce-photo-grid">{photos.map((p,i)=><div key={i}>
      <img src={p.image} alt={`Evidence photo ${i+1} preview`}/>
      <label>Evidence photo {i+1} caption<input aria-label={`Evidence photo ${i+1} caption`} value={p.caption} maxLength={300} required disabled={disabled || processing} onChange={e=>onChange(photos.map((photo,n)=>n===i?{...photo,caption:e.target.value}:photo))}/></label>
      <button type="button" disabled={disabled || processing} onClick={()=>onChange(photos.filter((_,n)=>n!==i))}>Remove evidence photo {i+1}</button>
    </div>)}</div>
    {error&&<p role="alert">{error}</p>}
  </div>;
}
export function SitePhotoEvidence({evidence=[]}:{evidence?:{assetId:string;caption:string}[]}) {
  return <div className="workforce-photo-grid">{evidence.map(p=><figure key={p.assetId}>
    <img loading="lazy" src={'/api/evidence/'+encodeURIComponent(p.assetId)} alt={p.caption}/><figcaption>{p.caption}</figcaption>
  </figure>)}</div>;
}
