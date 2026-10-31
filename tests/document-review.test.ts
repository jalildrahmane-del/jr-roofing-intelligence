import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Store } from "../server/store.ts";
import { createApp } from "../server/index.ts";
import { documentCommand, documentState, documentPdf } from "../server/documents.ts";
import { verifyIntegrity } from "../server/integrity.ts";
import { reviewPayload } from "./document-review-fixture.ts";
function fixture(type="RAMS") {
  const store=new Store(":memory:");
  const add=(name:string)=>({id:store.addUser(name,"synthetic-password","manager"),name,role:"manager" as const,company:"Synthetic"});
  const author=add("check-author"),reviewer=add("check-reviewer"),second=add("check-second");
  const pid=store.project(author,{name:"Synthetic reviewed project"}).id;
  const source=documentCommand(store,author,pid,"source",{title:"Synthetic source",reference:"S",content:"Synthetic exact evidence"});
  const draft=documentCommand(store,author,pid,"draft",{type,title:"Synthetic checklist draft",sources:[{recordId:source.id,excerpt:"exact evidence"}],proposals:"Synthetic proposed sequence",limitations:"Site checks outstanding"});
  const review=(data:any={},who=reviewer)=>documentCommand(store,who,pid,"review",{documentId:draft.id,decision:"accepted",attest:true,note:"Synthetic independent review",...reviewPayload(type),...data});
  return {store,author,reviewer,second,pid,source,draft,review};
}
test("RAMS and CPP acceptance require every explicit boolean checklist confirmation",()=>{
  for(const type of ["RAMS","CPP"]){const f=fixture(type);try{
    for(const data of [
      {checklistVersion:undefined,checks:undefined},
      {checks:{}},
      {checks:{...reviewPayload(type).checks,risks:false}},
      {checks:{...reviewPayload(type).checks,risks:"true"}},
      {checks:{...reviewPayload(type).checks,invented:true}},
      {checklistVersion:2},
    ])assert.throws(()=>f.review(data),/checklist/i);
    assert.equal(documentState(f.store,f.reviewer,f.pid).documents[0].reviewHistory.length,0);
    const accepted=f.review({checklistItems:[{id:"forged",label:"Client-invented label",confirmed:true}]});
    assert.ok(!accepted.data.checklistItems.some((i:any)=>i.id==="forged"));
    assert.equal(accepted.data.checklistItems.length,6);assert.ok(accepted.data.checklistItems.every((i:any)=>i.confirmed));
    assert.match(documentState(f.store,f.reviewer,f.pid).documents[0].status,/Reviewed for issue/);
    verifyIntegrity(f.store.db);
  }finally{f.store.close();}}
});
test("survey and specification use document checks without fictitious safety confirmations",()=>{
  for(const type of ["survey","specification"]){const f=fixture(type);try{
    const accepted=f.review();assert.equal(accepted.data.checklistItems.length,4);
    assert.ok(!accepted.data.checklistItems.some((i:any)=>i.id==="risks"));
  }finally{f.store.close();}}
});
test("rejection stores partial checks; stale decisions cannot overwrite newer reviews",()=>{
  const f=fixture();try{
    const rejected=f.review({decision:"rejected",checks:{scope:true},note:"Control evidence incomplete"});
    assert.equal(rejected.data.checks.scope,true);assert.equal(rejected.data.checks.risks,false);
    assert.match(documentState(f.store,f.reviewer,f.pid).documents[0].status,/Rejected/);
    assert.throws(()=>f.review({},f.second),/review changed/);
    const accepted=f.review({previousReviewId:rejected.id});
    assert.equal(accepted.data.previousReviewId,rejected.id);
    const doc=documentState(f.store,f.reviewer,f.pid).documents[0];assert.equal(doc.reviewHistory.length,2);
    assert.equal(doc.reviewHistory[0].data.decision,"rejected");assert.equal(doc.reviewHistory[0].reviewerName,"check-reviewer");
    assert.throws(()=>f.review({previousReviewId:rejected.id},f.second),/review changed/);
  }finally{f.store.close();}
});
test("legacy approvals retain their history but require a structured checklist review",()=>{
  const f=fixture();try{
    const legacy=f.store.transaction(()=>f.store.append(f.reviewer,f.pid,"intelligence.review",{documentId:f.draft.id,decision:"accepted",note:"Historical decision",fingerprint:createHash("sha256").update(JSON.stringify(f.draft)).digest("hex")}));
    let doc=documentState(f.store,f.reviewer,f.pid).documents[0];assert.match(doc.status,/Historical review/);assert.equal(doc.reviewHistory[0].id,legacy.id);
    f.review({previousReviewId:legacy.id});doc=documentState(f.store,f.reviewer,f.pid).documents[0];assert.match(doc.status,/Reviewed for issue/);assert.equal(doc.reviewHistory.length,2);
  }finally{f.store.close();}
});
test("source changes and document revisions reopen checklist review without altering previous decisions",async()=>{
  const f=fixture();try{
    const accepted=f.review();
    documentCommand(f.store,f.author,f.pid,"source",{replaces:f.source.id,title:"Revised source",reference:"S-B",content:"Revised exact evidence"});
    assert.match(documentState(f.store,f.reviewer,f.pid).documents[0].status,/Stale/);
    assert.throws(()=>f.review({previousReviewId:accepted.id}),/superseded/);
    const current=documentState(f.store,f.reviewer,f.pid).sources.find((s:any)=>s.kind==="intelligence.source"&&s.current)!;
    documentCommand(f.store,f.author,f.pid,"draft",{type:"RAMS",title:"Synthetic revised draft",replaces:f.draft.id,sources:[{recordId:current.id,excerpt:"exact evidence"}],proposals:"Revised controls",limitations:"Revised gaps"});
    const docs=documentState(f.store,f.reviewer,f.pid).documents;assert.equal(docs[0].status,"Superseded");assert.match(docs[1].status,/Draft/);assert.equal(docs[1].reviewHistory.length,0);assert.equal(docs[0].reviewHistory[0].id,accepted.id);
    assert.equal((await documentPdf(f.store,f.reviewer,f.pid,f.draft.id)).subarray(0,5).toString(),"%PDF-");
  }finally{f.store.close();}
});
test("HTTP cannot bypass checklist validation and records no partial acceptance",async()=>{
  const f=fixture(),server=createApp(f.store);await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  try{
    const token=f.store.login(f.reviewer.name,"synthetic-password")!;
    const response=await fetch(base+"/api/document-intelligence",{method:"POST",headers:{Origin:base,"Content-Type":"application/json",Cookie:"jr_session="+token},body:JSON.stringify({pid:f.pid,action:"review",data:{documentId:f.draft.id,decision:"accepted",attest:true,note:"Attempt checklist bypass"}})});
    assert.equal(response.status,400);assert.match((await response.json() as any).error,/checklist/i);
    assert.equal(documentState(f.store,f.reviewer,f.pid).documents[0].reviewHistory.length,0);
  }finally{await new Promise<void>(r=>server.close(()=>r()));f.store.close();}
});
