import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, roofData } from "./tender-fixture.ts";
const plan = {vertices:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],
 calibrationPoints:[{x:0,y:0},{x:100,y:0}],actualDistanceMetres:10,pitchDegrees:5,status:"preliminary-unverified"};
test("roof drawing and image survive revision and cannot be reassigned to another roof",()=>{
 const f=fixture();
 try {
   const initialEvidence=Number((f.store.db.prepare("SELECT count(*) n FROM evidence").get() as any).n);
   const saved=f.save("roof",{...roofData,previousId:f.roof.id,roofPlan:JSON.stringify(plan),roofPlanImage:f.image});
   assert.equal(saved.data.roofPlan.status,"preliminary-unverified");
   const assetId=saved.data.roofPlan.imageAssetId;
   assert.match(assetId,/^[a-f0-9-]{36}$/);
   const evidence=f.store.db.prepare("SELECT * FROM evidence WHERE id=? AND pid=?").get(assetId,f.project.id) as any;
   assert.ok(evidence);
   assert.equal(evidence.mime,"image/png");
   assert.equal(Number((f.store.db.prepare("SELECT count(*) n FROM evidence").get() as any).n),initialEvidence+1);
   const revised=f.save("roof",{...roofData,previousId:saved.id,observations:"Follow-up notes"});
   assert.equal(revised.data.roofPlan.imageAssetId,assetId);
   assert.equal(revised.data.area,100);
   assert.throws(()=>f.save("roof",{...roofData,previousId:revised.id,roofPlan:JSON.stringify({...plan,imageAssetId:"11111111-1111-4111-8111-111111111111"})}),/reassigned/);
   assert.throws(()=>f.save("roof",{...roofData,previousId:revised.id,roofPlan:JSON.stringify(plan),roofPlanImage:"data:image/svg+xml;base64,PHN2Zz4="}),/Invalid roof plan image/);
   assert.equal(Number((f.store.db.prepare("SELECT count(*) n FROM evidence").get() as any).n),initialEvidence+1);
 } finally {f.store.close();}
});
