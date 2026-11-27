import test from 'node:test';import assert from 'node:assert/strict';import {parseRoofGeoJson, roofGeoJsonExport, geographicOutline, roofGeographicCsv, geographicDistances} from '../src/roof-geojson.ts';
const polygon={type:'Polygon',coordinates:[[[-0.4,51.8],[-0.399,51.8],[-0.399,51.801],[-0.4,51.8]]]};
test('reads polygon and feature without trusting arbitrary properties',()=>{
 assert.equal(parseRoofGeoJson(JSON.stringify(polygon)).length,3);
 assert.deepEqual(parseRoofGeoJson(JSON.stringify({type:'Feature',geometry:polygon,properties:{area:999}})),polygon.coordinates[0].slice(0,-1));
});
test('rejects unclosed, invalid, oversized and unsupported geographic outlines',()=>{
 for(const p of [{type:'Point',coordinates:[0,0]},{...polygon,crs:{}},{...polygon,coordinates:[polygon.coordinates[0],polygon.coordinates[0]]},{...polygon,coordinates:[[[0,91],[1,0],[0,0],[0,91]]]}, {...polygon,coordinates:[polygon.coordinates[0].slice(0,-1)]}])assert.throws(()=>parseRoofGeoJson(JSON.stringify(p)));
 assert.throws(()=>parseRoofGeoJson(' '.repeat(100001)));
});

test('rejects self-crossing and zero-area outlines',()=>{
 for(const ring of [[[0,0],[0.01,0.01],[0,0.01],[0.01,0],[0,0]],[[0,0],[0.01,0],[0.02,0],[0,0]]]) assert.throws(()=>parseRoofGeoJson(JSON.stringify({type:'Polygon',coordinates:[ring]})));
});

test('geographic export closes the ring, preserves coordinates and marks unverified status',()=>{
 const points=parseRoofGeoJson(JSON.stringify(polygon));
 const text=roofGeoJsonExport(points), exported=JSON.parse(text);
 assert.deepEqual(parseRoofGeoJson(text),points);
 assert.deepEqual(exported.geometry.coordinates[0][0],exported.geometry.coordinates[0].at(-1));
 assert.equal(exported.properties.status,'preliminary-unverified');
 assert.throws(()=>roofGeoJsonExport([]));
});

test('centres narrow outlines on both axes so zoom targets the roof',()=>{
 assert.equal(geographicOutline([[0,0],[10,0],[10,1],[0,1]]),'20,163 280,163 280,137 20,137');
 assert.equal(geographicOutline([[0,0],[1,0],[1,10],[0,10]]),'137,280 163,280 163,20 137,20');
 assert.equal(geographicOutline([[0,0],[10,0],[10,10],[0,10]]),'20,280 280,280 280,20 20,20');
});

test('coordinate CSV preserves ordered numeric vertices and rejects invalid geometry',()=>{
 const points=parseRoofGeoJson(JSON.stringify(polygon));
 const rows=roofGeographicCsv(points).trim().split('\r\n');
 assert.equal(rows[0],'vertex,longitude_degrees,latitude_degrees,crs,status');
 assert.equal(rows.length,4);
 assert.equal(rows[1],'1,-0.4,51.8,EPSG:4326,preliminary-unverified');
 assert.equal(rows[3],'3,-0.399,51.801,EPSG:4326,preliminary-unverified');
 assert.throws(()=>roofGeographicCsv([[0,0],[1,1],[2,2]]));
});

test('GeoJSON size limit counts UTF-8 bytes for pasted Unicode properties',()=>{
 const small=JSON.stringify({type:'Feature',geometry:polygon,properties:{note:'é'.repeat(100)}});
 assert.equal(parseRoofGeoJson(small).length,3);
 const large=JSON.stringify({type:'Feature',geometry:polygon,properties:{note:'é'.repeat(60000)}});
 assert.ok(large.length<100000);
 assert.throws(()=>parseRoofGeoJson(large),/at most 100 KB/);
});

test('spherical distances include closing edge, latitude scaling and reversal invariance',()=>{
 const points: [number,number][]=[[0,0],[0.001,0],[0.001,0.001],[0,0.001]];
 const d=geographicDistances(points);
 assert.equal(d.edges.length,4);
 assert.deepEqual([d.edges[3].from,d.edges[3].to],[4,1]);
 assert.ok(Math.abs(d.edges[0].metres-111.1950802335)<1e-6);
 assert.ok(Math.abs(d.perimeterMetres-444.7803209)<0.001);
 assert.ok(Math.abs(geographicDistances([...points].reverse()).perimeterMetres-d.perimeterMetres)<1e-8);
 const north=geographicDistances(points.map(([x,y])=>[x,y+60]));
 assert.ok(Math.abs(north.edges[0].metres-55.5975401)<0.001);
 assert.throws(()=>geographicDistances([[0,0],[1,1],[2,2]]));
});
