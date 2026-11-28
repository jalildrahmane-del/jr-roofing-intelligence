import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReferenceImageRecord} from '../src/reference-image-record.ts';
const image={name:'synthetic.png',mimeType:'image/png',bytes:100,width:10,height:10,sha256:'a'.repeat(64)};
const points:[number,number][]=[[0,0],[0.001,0],[0.001,0.001]];
const record={format:'jr-reference-image',version:1,status:'preliminary-unverified',crs:'EPSG:4326',orientation:'north-up',image,bounds:{west:0,south:0,east:0.002,north:0.002},sourceReference:' Synthetic ',imageDate:'2026-01-15',rightsAndAlignmentNotes:null};
test('restores matching image records with trusted schema and fresh limitations',()=>{
 const restored=parseReferenceImageRecord(JSON.stringify({...record,limitations:'approved',url:'https://example.invalid/image'}),{...image,name:'renamed.png'},points);
 assert.equal(restored.image.name,'renamed.png');assert.equal(restored.sourceReference,'Synthetic');
 assert.match(restored.limitations,/not authenticity/);assert.ok(!('url' in restored));
 assert.deepEqual(restored.bounds,record.bounds);
});
test('rejects mismatched file evidence, unsafe bounds, unsupported formats and malformed metadata',()=>{
 for(const key of ['sha256','mimeType','bytes','width','height']){
 const bad={...record,image:{...image,[key]:key==='sha256'?'b'.repeat(64):'wrong'}};
 assert.throws(()=>parseReferenceImageRecord(JSON.stringify(bad),image,points),/does not match/);
 }
 for(const patch of [{version:2},{status:'approved'},{bounds:{west:0.01,south:0,east:0.02,north:0.02}},{imageDate:'2026-02-30'},{sourceReference:42},{rightsAndAlignmentNotes:'x'.repeat(1001)}])assert.throws(()=>parseReferenceImageRecord(JSON.stringify({...record,...patch}),image,points));
 assert.throws(()=>parseReferenceImageRecord(' '.repeat(100001),image,points),/100 KB/);
});

test('normalized records round-trip and dates obey the supported four-digit-year format',()=>{
 const normalized=parseReferenceImageRecord(JSON.stringify(record),image,points);
 assert.deepEqual(parseReferenceImageRecord(JSON.stringify(normalized),image,points),normalized);
 assert.throws(()=>parseReferenceImageRecord(JSON.stringify({...record,imageDate:'10000-01-01'}),image,points));
 const leap=parseReferenceImageRecord(JSON.stringify({...record,imageDate:'2024-02-29'}),image,points);
 assert.equal(leap.imageDate,'2024-02-29');
 assert.throws(()=>parseReferenceImageRecord(JSON.stringify({...record,imageDate:'2025-02-29'}),image,points));
});
