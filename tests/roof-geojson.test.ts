import test from 'node:test';import assert from 'node:assert/strict';import {parseRoofGeoJson, roofGeoJsonExport} from '../src/roof-geojson.ts';
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
