import {test} from 'node:test';import assert from 'node:assert/strict';
import {fixture,roofData} from './tender-fixture.ts';
test('geographic roof geometry is validated, retained in revisions and explicitly removable',()=>{
 const f=fixture();try{
 const geo={type:'Feature',properties:{approved:true,area:999},geometry:{type:'Polygon',coordinates:[[[-0.4,51.8],[-0.399,51.8],[-0.399,51.801],[-0.4,51.8]]]}};
 const saved=f.save('roof',{...roofData,previousId:f.roof.id,geographicOutline:JSON.stringify(geo)});
 assert.equal(saved.data.geographicOutline.properties.status,'preliminary-unverified');
 assert.equal(saved.data.geographicOutline.properties.approved,undefined);
 assert.equal(saved.data.area,100);
 const revised=f.save('roof',{...roofData,previousId:saved.id,observations:'Updated notes'});
 assert.deepEqual(revised.data.geographicOutline,saved.data.geographicOutline);
 assert.throws(()=>f.save('roof',{...roofData,previousId:revised.id,geographicOutline:'{"type":"Point"}'}));
 const cleared=f.save('roof',{...roofData,previousId:revised.id,geographicOutline:null});
 assert.equal(cleared.data.geographicOutline,null);
 assert.ok(saved.data.geographicOutline);
 }finally{f.store.close();}
});
