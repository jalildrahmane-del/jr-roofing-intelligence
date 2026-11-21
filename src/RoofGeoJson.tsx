import React, {useState} from 'react';
import {parseRoofGeoJson} from './roof-geojson.ts';
export function RoofGeoJson() {
 const [points,setPoints]=useState<[number,number][]|null>(null),[error,setError]=useState('');
 return <details><summary>Preview georeferenced roof outline</summary>
 <p>Import one WGS84 GeoJSON polygon. Preview only: no imagery service, saved survey update or approved measurement.</p>
 <label>Roof GeoJSON file<input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={async e=>{
 const file=e.target.files?.[0];setPoints(null);setError('');if(!file)return;
 try {if(file.size>100000)throw Error('GeoJSON must be at most 100 KB.');setPoints(parseRoofGeoJson(await file.text()));}catch(err){setError((err as Error).message);}
 }}/></label>
 {error&&<p role="alert">{error}</p>}
 {points&&<><p role="status">{points.length} geographic boundary points loaded. Longitude, latitude in degrees; not metres.</p><ol>{points.map((p,i)=><li key={i}>{p[0]}, {p[1]}</li>)}</ol><button type="button" onClick={()=>setPoints(null)}>Clear geographic preview</button></>}
 </details>;
}
