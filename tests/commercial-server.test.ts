import {test} from "node:test";
import assert from "node:assert/strict";
import {Store} from "../server/store.ts";
import {saveCommercial} from "../server/commercial-control.ts";
import type {User} from "../src/model.ts";

test("commercial records are manager-only, project-scoped and auditable",()=>{
 const store=new Store(":memory:");
 try{
  const manager:User={id:"manager",name:"Manager",role:"manager",company:"JR Roofing"};
  const viewer:User={id:"viewer",name:"Viewer",role:"viewer",company:"JR Roofing"};
  const project=store.project(manager,{name:"Test roofing project",client:"Fictional client",address:"Test"});
  assert.throws(()=>saveCommercial(store,viewer,project.id,"budget",{amountPence:100000,reference:"B01",note:"Basis"}),/Forbidden/);
  const record=saveCommercial(store,manager,project.id,"budget",{amountPence:100000,reference:"B01",note:"Basis"});
  assert.equal(record?.kind,"commercial.budget");
  assert.equal(store.snapshot(manager).records.filter(r=>r.kind==="commercial.budget").length,1);
  assert.throws(()=>saveCommercial(store,manager,"missing","budget",{amountPence:1,reference:"B",note:"Basis"}),/Project not found/);
 }finally{store.close()}
});
test("commercial values reject invalid money and missing client decision evidence",()=>{
 const store=new Store(":memory:");
 try{
  const manager:User={id:"manager",name:"Manager",role:"manager",company:"JR Roofing"};
  const project=store.project(manager,{name:"Test project"});
  assert.throws(()=>saveCommercial(store,manager,project.id,"cost",{costType:"actual",amountPence:-1,reference:"INV",description:"Labour"}),/non-negative/);
  assert.throws(()=>saveCommercial(store,manager,project.id,"variation",{reference:"V01",description:"Extra flashing",status:"accepted",amountPence:12000,decisionReference:""}),/decision reference/i);
 }finally{store.close()}
});
test("superseded variation revisions cannot be edited again",()=>{
 const store=new Store(":memory:");
 try{
  const manager:User={id:"manager",name:"Manager",role:"manager",company:"JR Roofing"};
  const project=store.project(manager,{name:"Test project"});
  const base={reference:"V01",description:"Extra flashing",amountPence:12000};
  const original=saveCommercial(store,manager,project.id,"variation",{...base,status:"proposed"});
  const revision=saveCommercial(store,manager,project.id,"variation",{...base,entityId:original!.id,status:"accepted",decisionReference:"CLIENT-01"});
  assert.equal(revision?.kind,"commercial.variation");
  assert.throws(()=>saveCommercial(store,manager,project.id,"variation",{...base,entityId:original!.id,status:"rejected",decisionReference:"CLIENT-02"}),/superseded/);
  const final=saveCommercial(store,manager,project.id,"variation",{...base,entityId:revision!.id,status:"rejected",decisionReference:"CLIENT-02"});
  assert.equal(final?.data.status,"rejected");
 }finally{store.close()}
});
