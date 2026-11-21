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
  return points;
}
