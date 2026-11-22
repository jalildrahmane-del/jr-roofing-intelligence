import React, {useState, useRef} from 'react';
import {parseRoofGeoJson, geographicOutline, roofGeoJsonExport} from './roof-geojson.ts';
export function RoofGeoJson({saved,onSave}:{saved?:unknown;onSave?:(outline:string|null)=>Promise<void>}) {
 const [saving,setSaving]=useState(false);
 const request = useRef(0);
 const [history,setHistory]=useState<[number,number][][]>([]);
 const [zoom,setZoom]=useState(1),[centre,setCentre]=useState({x:150,y:150});
 const resetView=()=>{setZoom(1);setCentre({x:150,y:150});};
 const pan=(x:number,y:number)=>setCentre(p=>({x:Math.max(0,Math.min(300,p.x+x*30/zoom)),y:Math.max(0,Math.min(300,p.y+y*30/zoom))}));
 const [points,setPoints]=useState<[number,number][]|null>(()=>{try{return saved?parseRoofGeoJson(JSON.stringify(saved)):null;}catch{return null;}}),[error,setError]=useState('');
 return <details><summary>Preview georeferenced roof outline</summary>
 <p>Import one WGS84 GeoJSON polygon. Preliminary outline: save a roof revision to retain it. No imagery service or approved measurement.</p>
 <label>Roof GeoJSON file<input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={async e=>{
 const generation=++request.current; const file=e.target.files?.[0];e.target.value="";setPoints(null);setHistory([]);setError('');resetView();if(!file)return;
 try {if(file.size>100000)throw Error('GeoJSON must be at most 100 KB.');const parsed=parseRoofGeoJson(await file.text());if(generation===request.current)setPoints(parsed);}catch(err){if(generation===request.current)setError((err as Error).message);}
 }}/></label>
 {onSave && <button type="button" disabled={saving || !points} onClick={async()=>{if(!points)return;setSaving(true);setError('');try{await onSave(roofGeoJsonExport(points));}catch(e){setError((e as Error).message);}finally{setSaving(false);}}}>{saving?'Saving geographic outline…':'Save geographic roof revision'}</button>}
 {onSave && saved != null && <button type="button" disabled={saving} onClick={async()=>{setSaving(true);setError('');try{await onSave(null);}catch(e){setError((e as Error).message);}finally{setSaving(false);}}}>Remove saved geographic outline</button>}
 {error&&<p role="alert">{error}</p>}
 {points&&<><GeoEditor key={JSON.stringify(points)} points={points} onApply={next=>{request.current++;setHistory(h=>[...h.slice(-19),points]);setPoints(next);resetView();}} /><button type="button" disabled={!history.length} onClick={()=>{
 const previous=history.at(-1);if(!previous)return;request.current++;setPoints(previous);setHistory(h=>h.slice(0,-1));setError('');resetView();
 }}>Undo geographic edit</button><div role="group" aria-label="Geographic outline navigation">
 <button type="button" disabled={zoom>=8} onClick={()=>setZoom(z=>Math.min(8,z*2))}>Zoom in outline</button>
 <button type="button" disabled={zoom<=1} onClick={()=>setZoom(z=>Math.max(1,z/2))}>Zoom out outline</button>
 <button type="button" onClick={()=>pan(-1,0)}>Pan outline west</button>
 <button type="button" onClick={()=>pan(1,0)}>Pan outline east</button>
 <button type="button" onClick={()=>pan(0,-1)}>Pan outline north</button>
 <button type="button" onClick={()=>pan(0,1)}>Pan outline south</button>
 <button type="button" onClick={resetView}>Fit outline</button>
 <span aria-live="polite">Outline zoom: {zoom}×</span></div><svg role="img" aria-label="Imported roof outline in longitude and latitude" viewBox={`${centre.x-150/zoom} ${centre.y-150/zoom} ${300/zoom} ${300/zoom}`}><title>North-up geographic coordinate diagram</title><polygon points={geographicOutline(points)} fill="#d6e6f2" stroke="#304b6b" strokeWidth="2" /></svg><p>North is up. Degree-coordinate diagram only; shapes are not corrected for map projection and must not be measured from this preview.</p><p role="status">{points.length} geographic boundary points loaded. Longitude, latitude in degrees; not metres.</p><ol>{points.map((p,i)=><li key={i}>{p[0]}, {p[1]}</li>)}</ol><button type="button" onClick={()=>{
 const url=URL.createObjectURL(new Blob([roofGeoJsonExport(points)],{type:'application/geo+json'}));
 const link=document.createElement('a');link.href=url;link.download='preliminary-roof-outline.geojson';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }}>Download validated GeoJSON outline</button><button type="button" onClick={()=>{request.current++;setPoints(null);setHistory([]);setError('');}}>Clear geographic preview</button></>}
 </details>;
}

function GeoEditor({points,onApply}:{points:[number,number][];onApply:(points:[number,number][])=>void}) {
 const [index,setIndex]=useState(0),[longitude,setLongitude]=useState(String(points[0][0])),[latitude,setLatitude]=useState(String(points[0][1])),[error,setError]=useState('');
 return <details><summary>Edit geographic vertex</summary>
 <p>Changes are preliminary and only applied after validation. Download the outline to keep them; save a geographic roof revision to retain them in the survey history.</p>
 <label>Geographic vertex<select aria-label="Geographic vertex" value={index} onChange={e=>{const i=Number(e.target.value);setIndex(i);setLongitude(String(points[i][0]));setLatitude(String(points[i][1]));setError('');}}>{points.map((_,i)=><option key={i} value={i}>Vertex {i+1}</option>)}</select></label>
 <label>Vertex longitude<input type="number" step="any" value={longitude} onChange={e=>setLongitude(e.target.value)} /></label>
 <label>Vertex latitude<input type="number" step="any" value={latitude} onChange={e=>setLatitude(e.target.value)} /></label>
 <button type="button" onClick={()=>{
 try {
 if(!longitude.trim()||!latitude.trim())throw Error('Enter both longitude and latitude.');
 const next=points.map((p,i)=>i===index?[Number(longitude),Number(latitude)] as [number,number]:p);
 const validated=parseRoofGeoJson(roofGeoJsonExport(next));setError('');onApply(validated);
 }catch(e){setError((e as Error).message);}
 }}>Apply geographic vertex</button>
 {error&&<p role="alert">{error}</p>}
 </details>;
}
