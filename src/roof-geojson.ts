import { measureRoofPlan } from "./roof-plan-geometry.ts";
/** Import one WGS84 roof outline. Does not infer an approved survey or area. */
export function parseRoofGeoJson(text: string): [number, number][] {
  if (text.length > 100000 || new TextEncoder().encode(text).byteLength > 100000) throw Error('GeoJSON must be at most 100 KB.');
  const input = JSON.parse(text);
  const geometry = input?.type === 'Feature' ? input.geometry : input;
  if (input?.crs || geometry?.crs || geometry?.type !== 'Polygon' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 1) {
    throw Error('Select one WGS84 Polygon without holes or a custom CRS.');
  }
  const ring = geometry.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4 || ring.length > 501) throw Error('Provide 3–500 boundary points and a closing point.');
  for (const p of ring) {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) throw Error('Coordinates must be longitude, latitude in WGS84 degrees.');
  }
  const first = ring[0], last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) throw Error('Polygon ring must be closed.');
  const points = ring.slice(0, -1) as [number, number][];
  if (new Set(points.map(p => p.join(','))).size !== points.length) throw Error('Boundary points must be distinct.');
  const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
  if (Math.max(...xs)-Math.min(...xs)>1 || Math.max(...ys)-Math.min(...ys)>1) throw Error('Select a local roof outline, not a regional or dateline-crossing polygon.');
  // Reuse topology validation in degree coordinates; the result is deliberately discarded.
  const local = points.map(p => ({x:(p[0]-first[0])*100000, y:(p[1]-first[1])*100000}));
  measureRoofPlan(local, {pointA:{x:0,y:0}, pointB:{x:1,y:0}, actualDistanceMetres:1});
  return points;
}

/** North-up degree-coordinate diagram, not a projected map or measurement. */
export function geographicOutline(points: [number, number][]): string {
  const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
  const minX=Math.min(...xs), maxY=Math.max(...ys);
  const width=Math.max(...xs)-minX, height=maxY-Math.min(...ys);
  const scale=260/Math.max(width,height);
  const offsetX=(300-width*scale)/2, offsetY=(300-height*scale)/2;
  return points.map(p=>`${offsetX+(p[0]-minX)*scale},${offsetY+(maxY-p[1])*scale}`).join(' ');
}

/** Export only validated geometry, never untrusted imported properties. */
export function roofGeoJsonExport(points: [number, number][]): string {
  const geometry = {type:'Polygon',coordinates:[[...points,points[0]]]};
  parseRoofGeoJson(JSON.stringify(geometry));
  return JSON.stringify({type:'Feature',properties:{status:'preliminary-unverified',limitations:'Imported outline only; independently verify location and geometry. Not an approved survey or measured quantity.'},geometry},null,2);
}

/** Ordered WGS84 vertices only; no measured or approved quantities. */
export function roofGeographicCsv(points: [number, number][]): string {
 const validated=parseRoofGeoJson(roofGeoJsonExport(points));
 return ['vertex,longitude_degrees,latitude_degrees,crs,status',...validated.map((p,i)=>`${i+1},${p[0]},${p[1]},EPSG:4326,preliminary-unverified`)].join('\r\n')+'\r\n';
}

/** Preliminary spherical horizontal distances, not slope lengths or approved quantities.
 * Haversine model and mean radius: https://turfjs.org/docs/api/distance
 * https://turfjs.org/docs/api/constants/earthRadius
 */
export function geographicDistances(points: [number, number][]) {
 const valid=parseRoofGeoJson(roofGeoJsonExport(points));
 const rad=Math.PI/180, radius=6371008.8;
 const edges=valid.map((a,i)=>{
  const b=valid[(i+1)%valid.length];
  const h=Math.sin((b[1]-a[1])*rad/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin((b[0]-a[0])*rad/2)**2;
  const clamped=Math.max(0,Math.min(1,h));
  return {from:i+1,to:(i+1)%valid.length+1,metres:2*radius*Math.atan2(Math.sqrt(clamped),Math.sqrt(1-clamped))};
 });
 return {edges,perimeterMetres:edges.reduce((sum,edge)=>sum+edge.metres,0)};
}

/** Self-contained preliminary record for independent review, not estimate adoption. */
export function geographicDistanceRecord(points: [number,number][]): string {
 const geometry=JSON.parse(roofGeoJsonExport(points)).geometry;
 return JSON.stringify({format:'jr-geographic-distances',version:1,status:'preliminary-unverified',crs:'EPSG:4326',coordinateOrder:'longitude,latitude',units:'metres',method:{name:'spherical-haversine',earthRadiusMetres:6371008.8},limitations:'Horizontal spherical estimates only. No slope, elevation or area. Independently verify coordinates and distances before estimating or construction.',geometry,...geographicDistances(points)},null,2);
}

/** Approximate spherical footprint area (Chamberlain–Duquette boundary sum).
 * Method reference: https://github.com/Turfjs/turf/blob/master/packages/turf-area/index.ts
 * Local validated rings only; not ellipsoidal, sloped or approved roof quantities.
 */
export function geographicArea(points: [number,number][]): number {
 const ring=parseRoofGeoJson(roofGeoJsonExport(points));
 const radians=Math.PI/180;
 // Subtract a fixed latitude sine to reduce cancellation for small roof outlines.
 // Its closed-ring integral is zero, so it does not change the boundary sum.
 const baseline=Math.sin(ring[0][1]*radians);
 const integral=ring.reduce((sum,a,i)=>{
  const b=ring[(i+1)%ring.length];
  return sum+(b[0]-a[0])*radians*((Math.sin(a[1]*radians)-baseline)+(Math.sin(b[1]*radians)-baseline))/2;
 },0);
 return Math.abs(integral)*6371008.8**2;
}

/** Current geometry plus reproducible preliminary measurements; never approval evidence. */
export function geographicMeasurementRecord(points: [number,number][]): string {
 const geometry=JSON.parse(roofGeoJsonExport(points)).geometry;
 return JSON.stringify({format:'jr-geographic-measurements',version:1,status:'preliminary-unverified',crs:'EPSG:4326',coordinateOrder:'longitude,latitude',
  methods:{distance:'spherical-haversine',area:'spherical-chamberlain-duquette',earthRadiusMetres:6371008.8},
  units:{distance:'metres',area:'square-metres'},
  limitations:'Approximate horizontal footprint and distances only. No slope, elevation, openings or waste allowance. Not adopted into estimate quantities. Independently verify location, geometry and measurements before estimating or construction.',
  geometry,footprintAreaSquareMetres:geographicArea(points),...geographicDistances(points)},null,2);
}

/** North-up local spherical equirectangular preview at the boundary's mid-latitude.
 * https://proj.org/en/stable/operations/projections/eqc.html (spherical forward formulas)
 * Common radius/radian scale cancels when fitting the viewport. Display only.
 */
export function geographicProjectedOutline(points: [number,number][]): string {
 const valid=parseRoofGeoJson(roofGeoJsonExport(points));
 const latitudes=valid.map(p=>p[1]);
 const minLatitude=Math.min(...latitudes),maxLatitude=Math.max(...latitudes);
 const longitudeScale=Math.cos((minLatitude+maxLatitude)/2*Math.PI/180);
 const originLongitude=valid[0][0];
 return geographicOutline(valid.map(([longitude,latitude])=>[(longitude-originLongitude)*longitudeScale,latitude-minLatitude]));
}
