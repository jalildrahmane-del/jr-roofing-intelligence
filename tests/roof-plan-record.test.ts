import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoofPlan } from "../src/roof-plan-record.ts";
const plan = { vertices:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],
  calibrationPoints:[{x:0,y:0},{x:100,y:0}],actualDistanceMetres:10,
  pitchDegrees:5,status:"preliminary-unverified" };
test("valid preliminary plan is revalidated and retained",()=>{
  assert.deepEqual(parseRoofPlan(JSON.stringify(plan)),plan);
});
test("missing plan is optional",()=>assert.equal(parseRoofPlan(undefined),null));
test("invalid JSON is rejected",()=>assert.throws(()=>parseRoofPlan("{"),/JSON/));
test("unverified status cannot be changed to approved",()=>assert.throws(()=>
  parseRoofPlan(JSON.stringify({...plan,status:"approved"})),/structure/));
test("self-crossing geometry is rejected server-side",()=>assert.throws(()=>
  parseRoofPlan(JSON.stringify({...plan,vertices:[{x:0,y:0},{x:100,y:100},{x:0,y:100},{x:100,y:0}]})),/intersect/));
test("invalid calibration and pitch are rejected server-side",()=>{
  assert.throws(()=>parseRoofPlan(JSON.stringify({...plan,actualDistanceMetres:0})),/Calibration/);
  assert.throws(()=>parseRoofPlan(JSON.stringify({...plan,pitchDegrees:90})),/pitch/);
});
