import React, {useEffect,useRef,useState} from 'react';
import {geographicImageFrame, type GeographicImageBounds} from './roof-geojson.ts';
export type GeographicImage = {url:string;bounds:GeographicImageBounds};
export function GeographicImagery({points,onChange}:{points:[number,number][];onChange:(image:GeographicImage|null)=>void}) {
 const [url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [bounds,setBounds]=useState({west:'',south:'',east:'',north:''});
 const generation=useRef(0);
 useEffect(()=>()=>{generation.current++;onChange(null);},[onChange]);
 return <details><summary>Local georeferenced reference image</summary>
 <p>Use a north-up PNG or JPEG already referenced to a rectangular WGS84 longitude/latitude extent. Enter its source bounds; do not guess them from the roof. Rotated images, ordinary photographs and Web Mercator screenshots are not supported. Verify image rights, date and alignment independently.</p>
 <p>Local preview only: image and bounds are not uploaded, saved in roof revisions or included in exports. Reload removes them.</p>
 <label>Local reference image<input type="file" accept="image/png,image/jpeg" onChange={async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 const current=++generation.current;setBusy(true);setError('');
 try {
 if(!['image/png','image/jpeg'].includes(file.type)||file.size>10*1024*1024)throw Error('Choose a PNG or JPEG up to 10 MB.');
 const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Could not read image.'));reader.readAsDataURL(file);});
 const image=new Image();image.src=data;await image.decode();
 if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>25000000)throw Error('Image must contain at most 25 million pixels.');
 if(current===generation.current)setUrl(data);
 }catch(err){if(current===generation.current)setError((err as Error).message);}finally{if(current===generation.current)setBusy(false);}
 }}/></label>
 {(['west','south','east','north'] as const).map(key=><label key={key}>Image {key} bound<input type="number" step="any" value={bounds[key]} onChange={e=>setBounds(b=>({...b,[key]:e.target.value}))}/></label>)}
 <button type="button" disabled={!url||busy} onClick={()=>{try{
 if(Object.values(bounds).some(v=>!v.trim()))throw Error('Enter all four source bounds.');
 const parsed={west:Number(bounds.west),south:Number(bounds.south),east:Number(bounds.east),north:Number(bounds.north)};
 geographicImageFrame(points,parsed);onChange({url,bounds:parsed});setError('');
 }catch(err){setError((err as Error).message);}}}>Apply reference image bounds</button>
 <button type="button" onClick={()=>{generation.current++;setBusy(false);setUrl('');setError('');onChange(null);}}>Remove reference image</button>
 {busy&&<p>Reading reference image…</p>}{error&&<p role="alert">{error}</p>}
 </details>;
}
