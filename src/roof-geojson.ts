import { measureRoofPlan } from "./roof-plan-geometry.ts";
/** Import one WGS84 roof outline. Does not infer an approved survey or area. */
export function parseRoofGeoJson(text: string): [number, number][] {
  if (text.length > 100000) throw Error('GeoJSON must be at most 100 KB.');
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
