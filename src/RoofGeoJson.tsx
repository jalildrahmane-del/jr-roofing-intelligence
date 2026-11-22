import React, {useState, useRef} from 'react';
import {parseRoofGeoJson, geographicOutline, roofGeoJsonExport} from './roof-geojson.ts';
export function RoofGeoJson() {
 const request = useRef(0);
 const [zoom,setZoom]=useState(1),[centre,setCentre]=useState({x:150,y:150});
 const resetView=()=>{setZoom(1);setCentre({x:150,y:150});};
 const pan=(x:number,y:number)=>setCentre(p=>({x:Math.max(0,Math.min(300,p.x+x*30/zoom)),y:Math.max(0,Math.min(300,p.y+y*30/zoom))}));
 const [points,setPoints]=useState<[number,number][]|null>(null),[error,setError]=useState('');
 return <details><summary>Preview georeferenced roof outline</summary>
 <p>Import one WGS84 GeoJSON polygon. Preview only: no imagery service, saved survey update or approved measurement.</p>
 <label>Roof GeoJSON file<input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={async e=>{
 const generation=++request.current; const file=e.target.files?.[0];setPoints(null);setError('');resetView();if(!file)return;
 try {if(file.size>100000)throw Error('GeoJSON must be at most 100 KB.');const parsed=parseRoofGeoJson(await file.text());if(generation===request.current)setPoints(parsed);}catch(err){if(generation===request.current)setError((err as Error).message);}
 }}/></label>
 {error&&<p role="alert">{error}</p>}
 {points&&<><div role="group" aria-label="Geographic outline navigation">
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
 }}>Download validated GeoJSON outline</button><button type="button" onClick={()=>{request.current++;setPoints(null);setError('');}}>Clear geographic preview</button></>}
 </details>;
}
