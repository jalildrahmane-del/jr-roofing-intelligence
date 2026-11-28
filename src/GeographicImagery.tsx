import {parseReferenceImageRecord,imageRecordLimitations,type ImageMetadata} from './reference-image-record.ts';
import React, {useEffect,useRef,useState} from 'react';
import {geographicImageFrame, type GeographicImageBounds} from './roof-geojson.ts';
export type GeographicImage = {url:string;bounds:GeographicImageBounds};
export function GeographicImagery({points,onChange}:{points:[number,number][];onChange:(image:GeographicImage|null)=>void}) {
 const [url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [metadata,setMetadata]=useState<ImageMetadata|null>(null);
 const [record,setRecord]=useState('');
 const [sourceReference,setSourceReference]=useState(''),[imageDate,setImageDate]=useState(''),[rightsNotes,setRightsNotes]=useState('');
 const [bounds,setBounds]=useState({west:'',south:'',east:'',north:''});
 const generation=useRef(0);
 useEffect(()=>{generation.current++;setBusy(false);},[points]);
 useEffect(()=>()=>{generation.current++;onChange(null);},[onChange]);
 return <details><summary>Local georeferenced reference image</summary>
 <p>Use a north-up PNG or JPEG already referenced to a rectangular WGS84 longitude/latitude extent. Enter its source bounds; do not guess them from the roof. Rotated images, ordinary photographs and Web Mercator screenshots are not supported. Verify image rights, date and alignment independently.</p>
 <p>Local preview only: images are not uploaded or saved in roof revisions. Reload removes the preview. Download an applied image record to retain its hash, source details and bounds; the record contains no image data.</p>
 <label>Local reference image<input type="file" accept="image/png,image/jpeg" onChange={async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 const current=++generation.current;setBusy(true);setError('');
 try {
 if(!['image/png','image/jpeg'].includes(file.type)||file.size>10*1024*1024)throw Error('Choose a PNG or JPEG up to 10 MB.');
 const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Could not read image.'));reader.readAsDataURL(file);});
 const image=new Image();image.src=data;await image.decode();
 if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>25000000)throw Error('Image must contain at most 25 million pixels.');
 if(!globalThis.crypto?.subtle)throw Error('Image hashing requires HTTPS or localhost.');
 const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
 const sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(current===generation.current){setUrl(data);setMetadata({name:file.name,mimeType:file.type,bytes:file.size,width:image.naturalWidth,height:image.naturalHeight,sha256});}
 }catch(err){if(current===generation.current)setError((err as Error).message);}finally{if(current===generation.current)setBusy(false);}
 }}/></label>
 <label>Restore reference image record<input type="file" accept=".json,application/json" disabled={!metadata||busy} onChange={async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file||!metadata)return;
 const current=++generation.current;setBusy(true);setError('');
 try {
 if(file.size>100000)throw Error('Image record must be at most 100 KB.');
 const restored=parseReferenceImageRecord(await file.text(),metadata,points);
 if(current!==generation.current)return;
 setBounds({west:String(restored.bounds.west),south:String(restored.bounds.south),east:String(restored.bounds.east),north:String(restored.bounds.north)});
 setSourceReference(restored.sourceReference||'');setImageDate(restored.imageDate||'');setRightsNotes(restored.rightsAndAlignmentNotes||'');
 onChange({url,bounds:restored.bounds});setRecord(JSON.stringify(restored,null,2));
 }catch(err){if(current===generation.current)setError((err as Error).message);}finally{if(current===generation.current)setBusy(false);}
 }}/></label>
 <p>Select the original image first, then restore its exported record. A matching hash identifies the file; source details still require independent verification.</p>
 {(['west','south','east','north'] as const).map(key=><label key={key}>Image {key} bound<input type="number" step="any" value={bounds[key]} onChange={e=>setBounds(b=>({...b,[key]:e.target.value}))}/></label>)}
 <label>Image source reference<input value={sourceReference} maxLength={500} onChange={e=>setSourceReference(e.target.value)}/></label>
 <label>Image capture date<input type="date" value={imageDate} onChange={e=>setImageDate(e.target.value)}/></label>
 <label>Image rights and alignment notes<textarea value={rightsNotes} maxLength={1000} onChange={e=>setRightsNotes(e.target.value)}/></label>
 <p>Source details are user-supplied, not verified. Leave unknown dates blank. Apply bounds to snapshot these details for the current image.</p>
 <button type="button" disabled={!url||!metadata||busy} onClick={()=>{try{
 if(Object.values(bounds).some(v=>!v.trim()))throw Error('Enter all four source bounds.');
 const parsed={west:Number(bounds.west),south:Number(bounds.south),east:Number(bounds.east),north:Number(bounds.north)};
 geographicImageFrame(points,parsed);onChange({url,bounds:parsed});
 setRecord(JSON.stringify({format:'jr-reference-image',version:1,status:'preliminary-unverified',crs:'EPSG:4326',orientation:'north-up',image:metadata,bounds:parsed,sourceReference:sourceReference.trim()||null,imageDate:imageDate||null,rightsAndAlignmentNotes:rightsNotes.trim()||null,limitations:imageRecordLimitations},null,2));setError('');
 }catch(err){setError((err as Error).message);}}}>Apply reference image bounds</button>
 <button type="button" onClick={()=>{generation.current++;setBusy(false);setUrl('');setMetadata(null);setRecord('');setError('');onChange(null);}}>Remove reference image</button>
 <button type="button" disabled={!record||busy} onClick={()=>{
 const link=document.createElement('a'),downloadUrl=URL.createObjectURL(new Blob([record],{type:'application/json'}));
 link.href=downloadUrl;link.download='preliminary-reference-image.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(downloadUrl),1000);
 }}>Download applied image record</button>
 {busy&&<p>Reading reference image…</p>}{error&&<p role="alert">{error}</p>}
 </details>;
}
