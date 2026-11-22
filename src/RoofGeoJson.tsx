import React, {useState, useRef} from 'react';
import {parseRoofGeoJson, geographicOutline, roofGeoJsonExport} from './roof-geojson.ts';
export function RoofGeoJson() {
 const request = useRef(0);
 const [points,setPoints]=useState<[number,number][]|null>(null),[error,setError]=useState('');
 return <details><summary>Preview georeferenced roof outline</summary>
 <p>Import one WGS84 GeoJSON polygon. Preview only: no imagery service, saved survey update or approved measurement.</p>
 <label>Roof GeoJSON file<input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={async e=>{
 const generation=++request.current; const file=e.target.files?.[0];setPoints(null);setError('');if(!file)return;
 try {if(file.size>100000)throw Error('GeoJSON must be at most 100 KB.');const parsed=parseRoofGeoJson(await file.text());if(generation===request.current)setPoints(parsed);}catch(err){if(generation===request.current)setError((err as Error).message);}
 }}/></label>
 {error&&<p role="alert">{error}</p>}
 {points&&<><svg role="img" aria-label="Imported roof outline in longitude and latitude" viewBox="0 0 300 300"><title>North-up geographic coordinate diagram</title><polygon points={geographicOutline(points)} fill="#d6e6f2" stroke="#304b6b" strokeWidth="2" /></svg><p>North is up. Degree-coordinate diagram only; shapes are not corrected for map projection and must not be measured from this preview.</p><p role="status">{points.length} geographic boundary points loaded. Longitude, latitude in degrees; not metres.</p><ol>{points.map((p,i)=><li key={i}>{p[0]}, {p[1]}</li>)}</ol><button type="button" onClick={()=>{
 const url=URL.createObjectURL(new Blob([roofGeoJsonExport(points)],{type:'application/geo+json'}));
 const link=document.createElement('a');link.href=url;link.download='preliminary-roof-outline.geojson';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }}>Download validated GeoJSON outline</button><button type="button" onClick={()=>{request.current++;setPoints(null);setError('');}}>Clear geographic preview</button></>}
 </details>;
}
