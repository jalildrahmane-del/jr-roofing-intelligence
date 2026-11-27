import React, {useState, useRef, useMemo, useLayoutEffect} from 'react';
import {parseRoofGeoJson, geographicProjectedOutline, roofGeoJsonExport, roofGeographicCsv, geographicDistances, geographicDistanceRecord, geographicArea, geographicMeasurementRecord} from './roof-geojson.ts';
export function RoofGeoJson({saved,onSave}:{saved?:unknown;onSave?:(outline:string|null)=>Promise<void>}) {
 const [selectedIndex,setSelectedIndex]=useState(0);
 const [openEditorRequest,setOpenEditorRequest]=useState(0);
 const [saving,setSaving]=useState(false);
 const [pasted,setPasted]=useState('');
 const [importing,setImporting]=useState(false);
 const request = useRef(0);
 const [future,setFuture]=useState<[number,number][][]>([]);
 const [history,setHistory]=useState<[number,number][][]>([]);
 const [zoom,setZoom]=useState(1),[centre,setCentre]=useState({x:150,y:150});
 const resetView=()=>{setSelectedIndex(0);setOpenEditorRequest(0);setZoom(1);setCentre({x:150,y:150});};
 const pan=(x:number,y:number)=>setCentre(p=>({x:Math.max(0,Math.min(300,p.x+x*30/zoom)),y:Math.max(0,Math.min(300,p.y+y*30/zoom))}));
 const savedPoints=useMemo(()=>{try{return saved?parseRoofGeoJson(JSON.stringify(saved)):null;}catch{return null;}},[saved]);
 const [points,setPoints]=useState<[number,number][]|null>(savedPoints),[error,setError]=useState('');
 const distances=useMemo(()=>points?geographicDistances(points):null,[points]);
 const outline=useMemo(()=>points?geographicProjectedOutline(points):'', [points]);
 const area=useMemo(()=>points?geographicArea(points):null,[points]);
 const dirty=points!==null && JSON.stringify(points)!==JSON.stringify(savedPoints);
 return <details><summary>Preview georeferenced roof outline</summary>
 <p>Import one WGS84 GeoJSON polygon. Preliminary outline: save a roof revision to retain it. No imagery service or approved measurement.</p>
 <p aria-live="polite">{points ? dirty ? 'Unsaved geographic changes — save a roof revision to retain them.' : 'Geographic outline matches the saved roof revision.' : savedPoints ? 'Preview cleared; the saved geographic outline is unchanged.' : 'No geographic outline saved.'}</p>
 {savedPoints && (dirty || !points) && <button type="button" disabled={saving} onClick={()=>{request.current++;setImporting(false);setPoints(savedPoints);setHistory([]);setFuture([]);setError('');resetView();}}>Restore saved geographic outline</button>}
 <details><summary>Paste GeoJSON boundary</summary>
 <label>GeoJSON boundary text<textarea value={pasted} onChange={e=>setPasted(e.target.value)} /></label>
 <p>Paste one WGS84 polygon, up to 100 KB. Import validates it before replacing the working outline.</p>
 <button type="button" disabled={saving || !pasted.trim()} onClick={()=>{
 request.current++;setImporting(false);setError('');
 try {const next=parseRoofGeoJson(pasted);setPoints(next);setHistory([]);setFuture([]);resetView();setPasted('');}catch(e){setError((e as Error).message);}
 }}>Import pasted geographic outline</button></details>
 <label>Roof GeoJSON file<input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={async e=>{
 const file=e.target.files?.[0];e.target.value="";if(!file)return;
 const generation=++request.current;setImporting(true);setError('');
 try {if(file.size>100000)throw Error('GeoJSON must be at most 100 KB.');const parsed=parseRoofGeoJson(await file.text());if(generation===request.current){setPoints(parsed);setHistory([]);setFuture([]);resetView();}}catch(err){if(generation===request.current)setError((err as Error).message);}finally{if(generation===request.current)setImporting(false);}
 }}/></label>
 {importing && <p aria-live="polite">Reading geographic outline… Save is unavailable until validation finishes.</p>}
 {onSave && <button type="button" disabled={saving || importing || !points} onClick={async()=>{if(!points)return;setSaving(true);setError('');try{await onSave(roofGeoJsonExport(points));}catch(e){setError((e as Error).message);}finally{setSaving(false);}}}>{saving?'Saving geographic outline…':'Save geographic roof revision'}</button>}
 {onSave && saved != null && <button type="button" disabled={saving} onClick={async()=>{setSaving(true);setError('');try{await onSave(null);}catch(e){setError((e as Error).message);}finally{setSaving(false);}}}>Remove saved geographic outline</button>}
 {error&&<p role="alert">{error}</p>}
 {area!==null&&<section aria-label="Preliminary geographic footprint area"><h4>Preliminary footprint area</h4><p>Approximate horizontal footprint: <strong>{area.toFixed(2)}</strong> m²</p><p>Spherical approximation from the current boundary, not sloped roof area. Excludes pitch, openings and waste. Independently verify before estimating or construction; not adopted into quantities.</p></section>}
 {distances&&<section aria-label="Preliminary geographic distances"><h4>Preliminary horizontal distances</h4><p>Spherical estimate from imported coordinates; excludes roof slope and elevation. Independently verify before estimating or construction.</p><p>Approximate perimeter: {distances.perimeterMetres.toFixed(2)} m</p><table><thead><tr><th>Edge</th><th>Approximate length (m)</th></tr></thead><tbody>{distances.edges.map(edge=><tr key={edge.from}><td>{edge.from} → {edge.to}</td><td>{edge.metres.toFixed(2)}</td></tr>)}</tbody></table></section>}
 {points&&<button type="button" disabled={importing} onClick={()=>{
 const url=URL.createObjectURL(new Blob([geographicDistanceRecord(points)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download='preliminary-geographic-distances.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }}>Download geographic distance record</button>}
 {points&&<button type="button" disabled={importing} onClick={()=>{
 const url=URL.createObjectURL(new Blob([geographicMeasurementRecord(points)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download='preliminary-geographic-measurements.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }}>Download geographic measurement record</button>}
 {points&&<><GeoEditor points={points} index={Math.min(selectedIndex,points.length-1)} setIndex={setSelectedIndex} openRequest={openEditorRequest} onApply={next=>{if(JSON.stringify(next)===JSON.stringify(points))return;request.current++;setImporting(false);setFuture([]);setHistory(h=>[...h.slice(-19),points]);setPoints(next);resetView();}} /><button type="button" disabled={!history.length} onClick={()=>{
 const previous=history.at(-1);if(!previous)return;request.current++;setImporting(false);setFuture(f=>[...f.slice(-19),points]);setPoints(previous);setHistory(h=>h.slice(0,-1));setError('');resetView();
 }}>Undo geographic edit</button><button type="button" disabled={!future.length} onClick={()=>{
 const next=future.at(-1);if(!next)return;request.current++;setImporting(false);setHistory(h=>[...h.slice(-19),points]);setPoints(next);setFuture(f=>f.slice(0,-1));setError('');resetView();
 }}>Redo geographic edit</button><div role="group" aria-label="Geographic outline navigation">
 <button type="button" disabled={zoom>=8} onClick={()=>setZoom(z=>Math.min(8,z*2))}>Zoom in outline</button>
 <button type="button" disabled={zoom<=1} onClick={()=>setZoom(z=>Math.max(1,z/2))}>Zoom out outline</button>
 <button type="button" onClick={()=>pan(-1,0)}>Pan outline west</button>
 <button type="button" onClick={()=>pan(1,0)}>Pan outline east</button>
 <button type="button" onClick={()=>pan(0,-1)}>Pan outline north</button>
 <button type="button" onClick={()=>pan(0,1)}>Pan outline south</button>
 <button type="button" onClick={resetView}>Fit outline</button>
 <span aria-live="polite">Outline zoom: {zoom}×</span></div><svg role="group" aria-label="Imported roof outline in longitude and latitude" viewBox={`${centre.x-150/zoom} ${centre.y-150/zoom} ${300/zoom} ${300/zoom}`}><title>North-up local projected outline</title><polygon points={outline} fill="#d6e6f2" stroke="#304b6b" strokeWidth={2/zoom} />{outline.split(' ').map((coordinate,i)=>{const [x,y]=coordinate.split(',').map(Number);return <g key={i} role="button" tabIndex={0} aria-label={`Select geographic vertex ${i+1}`} aria-pressed={i===selectedIndex} onClick={()=>{setSelectedIndex(i);setOpenEditorRequest(n=>n+1);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedIndex(i);setOpenEditorRequest(n=>n+1);}}} style={{cursor:'pointer'}}><circle cx={x} cy={y} r={3/zoom} fill={i===selectedIndex?'#b04410':'#304b6b'} /><text x={x+5/zoom} y={y-5/zoom} fontSize={12/zoom} fill="#172c42" stroke="white" strokeWidth={2/zoom} paintOrder="stroke">{i+1}</text><circle cx={x} cy={y} r={12/zoom} fill="transparent" stroke={i===selectedIndex?'#b04410':'transparent'} strokeWidth={1/zoom}/></g>;})}</svg><p>Select a numbered corner to edit its coordinates. Keyboard: focus a corner and press Enter or Space.</p><p>North is up. Local spherical equirectangular preview, corrected for longitude scale at the boundary’s mid-latitude. Approximate shape only; not aerial imagery or an approved survey. Do not measure from this preview.</p><p role="status">{points.length} geographic boundary points loaded. Longitude, latitude in degrees; not metres.</p><ol>{points.map((p,i)=><li key={i}>{p[0]}, {p[1]}</li>)}</ol><button type="button" onClick={()=>{
 const url=URL.createObjectURL(new Blob([roofGeoJsonExport(points)],{type:'application/geo+json'}));
 const link=document.createElement('a');link.href=url;link.download='preliminary-roof-outline.geojson';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }}>Download validated GeoJSON outline</button><button type="button" onClick={()=>{
 const url=URL.createObjectURL(new Blob([roofGeographicCsv(points)],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='preliminary-geographic-vertices.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }}>Download geographic coordinates CSV</button><button type="button" onClick={()=>{request.current++;setImporting(false);setPoints(null);setHistory([]);setFuture([]);setError('');}}>Clear geographic preview</button></>}
 </details>;
}

function GeoEditor({points,index,setIndex,openRequest,onApply}:{points:[number,number][];index:number;setIndex:(index:number)=>void;openRequest:number;onApply:(points:[number,number][])=>void}) {
 const [longitude,setLongitude]=useState(String(points[index][0])),[latitude,setLatitude]=useState(String(points[index][1])),[error,setError]=useState('');
 const editor=useRef<HTMLDetailsElement>(null);
 useLayoutEffect(()=>{setLongitude(String(points[index][0]));setLatitude(String(points[index][1]));setError('');},[points,index]);
 useLayoutEffect(()=>{if(editor.current)editor.current.open=false;},[points]);
 useLayoutEffect(()=>{if(openRequest>0&&editor.current)editor.current.open=true;},[openRequest]);
 return <details ref={editor}><summary>Edit geographic vertex</summary>
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
 <button type="button" disabled={points.length>=500} onClick={()=>{
 try {
 if(!longitude.trim()||!latitude.trim())throw Error('Enter both longitude and latitude.');
 const next=[...points.slice(0,index+1),[Number(longitude),Number(latitude)] as [number,number],...points.slice(index+1)];
 const validated=parseRoofGeoJson(roofGeoJsonExport(next));setError('');onApply(validated);
 }catch(e){setError((e as Error).message);}
 }}>Insert geographic vertex after selected</button>
 <p>To add a corner, enter its coordinates and insert it after the selected vertex. The entire boundary must remain valid.</p>
 <button type="button" disabled={points.length<=3} onClick={()=>{
 try {const next=points.filter((_,i)=>i!==index);const validated=parseRoofGeoJson(roofGeoJsonExport(next));setError('');onApply(validated);}catch(e){setError((e as Error).message);}
 }}>Remove geographic vertex</button>
 {error&&<p role="alert">{error}</p>}
 </details>;
}
