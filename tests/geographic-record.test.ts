import {saveRecord} from "../server/index.ts";
import {test} from 'node:test';import assert from 'node:assert/strict';
import {fixture,roofData} from './tender-fixture.ts';
test('geographic roof geometry is validated, retained in revisions and explicitly removable',()=>{
 const f=fixture();try{
 const geo={type:'Feature',properties:{approved:true,area:999},geometry:{type:'Polygon',coordinates:[[[-0.4,51.8],[-0.399,51.8],[-0.399,51.801],[-0.4,51.8]]]}};
 const saved=f.save('roof',{...roofData,previousId:f.roof.id,geographicOutline:JSON.stringify(geo)});
 assert.equal(saved.data.geographicOutline.properties.status,'preliminary-unverified');
 assert.equal(saved.data.geographicOutline.properties.approved,undefined);
 assert.equal(saved.data.area,100);
 assert.throws(()=>saveRecord(f.store,f.viewer,f.project.id,'roof',{...roofData,previousId:saved.id,geographicOutline:null}));
 assert.throws(()=>saveRecord(f.store,f.worker,f.project.id,'roof',{...roofData,previousId:saved.id,geographicOutline:null}));
 const revised=f.save('roof',{...roofData,previousId:saved.id,observations:'Updated notes'});
 assert.deepEqual(revised.data.geographicOutline,saved.data.geographicOutline);
 assert.throws(()=>f.save('roof',{...roofData,previousId:revised.id,geographicOutline:'{"type":"Point"}'}));
 const cleared=f.save('roof',{...roofData,previousId:revised.id,geographicOutline:null});
 assert.equal(cleared.data.geographicOutline,null);
 assert.ok(saved.data.geographicOutline);
 }finally{f.store.close();}
});

test('geographic revisions cannot reuse a predecessor from another project or stale revision',()=>{
 const f=fixture();try{
 const geo=JSON.stringify({type:'Polygon',coordinates:[[[-0.4,51.8],[-0.399,51.8],[-0.399,51.801],[-0.4,51.8]]]});
 const saved=f.save('roof',{...roofData,previousId:f.roof.id,geographicOutline:geo});
 const other=f.store.project(f.author,{name:'Synthetic other site',client:'Test',address:'Synthetic',area:100,type:'Commercial',roof:'Mixed'});
 assert.throws(()=>f.store.transaction(()=>saveRecord(f.store,f.author,other.id,'roof',{...roofData,previousId:saved.id,geographicOutline:geo})));
 const next=f.save('roof',{...roofData,previousId:saved.id,observations:'Latest revision'});
 assert.throws(()=>f.save('roof',{...roofData,previousId:saved.id,geographicOutline:null}));
 assert.deepEqual(next.data.geographicOutline,saved.data.geographicOutline);
 assert.equal(next.data.area,100);
 }finally{f.store.close();}
});

test('image provenance is revisioned, sanitized, permission checked and explicitly removable',()=>{
 const f=fixture();try{
 const geo=JSON.stringify({type:'Polygon',coordinates:[[[-0.4,51.8],[-0.399,51.8],[-0.399,51.801],[-0.4,51.8]]]});
 const record={format:'jr-reference-image',version:1,status:'preliminary-unverified',crs:'EPSG:4326',orientation:'north-up',image:{name:'synthetic.png',mimeType:'image/png',bytes:100,width:10,height:10,sha256:'a'.repeat(64),data:'not-persisted'},bounds:{west:-0.401,south:51.799,east:-0.398,north:51.802},sourceReference:'Synthetic only',url:'not-persisted'};
 const saved=f.save('roof',{...roofData,previousId:f.roof.id,geographicOutline:geo,referenceImageRecord:JSON.stringify(record)});
 assert.equal(saved.data.referenceImageRecord.sourceReference,'Synthetic only');
 assert.equal(saved.data.referenceImageRecord.image.data,undefined);assert.equal(saved.data.referenceImageRecord.url,undefined);
 assert.equal(saved.data.area,100);
 assert.throws(()=>f.save('roof',{...roofData,previousId:saved.id,referenceImageRecord:{...record,image:{...record.image,bytes:-1}}}));
 assert.throws(()=>saveRecord(f.store,f.viewer,f.project.id,'roof',{...roofData,previousId:saved.id,referenceImageRecord:null}));
 const other=f.store.project(f.author,{name:'Other synthetic',client:'Test',address:'Synthetic',area:100,type:'Commercial',roof:'Mixed'});
 assert.throws(()=>f.store.transaction(()=>saveRecord(f.store,f.author,other.id,'roof',{...roofData,previousId:saved.id,geographicOutline:geo,referenceImageRecord:record})));
 const revised=f.save('roof',{...roofData,previousId:saved.id,observations:'Notes revised'});
 assert.deepEqual(revised.data.referenceImageRecord,saved.data.referenceImageRecord);
 assert.throws(()=>f.save('roof',{...roofData,previousId:saved.id,referenceImageRecord:null}));
 const removed=f.save('roof',{...roofData,previousId:revised.id,referenceImageRecord:null});
 assert.equal(removed.data.referenceImageRecord,null);assert.ok(saved.data.referenceImageRecord);
 }finally{f.store.close();}
});
