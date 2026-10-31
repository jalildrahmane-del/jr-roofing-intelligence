import { reviewPayload } from "./document-review-fixture.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store.ts";
import { createApp, saveRecord } from "../server/index.ts";
import { documentCommand, documentState } from "../server/documents.ts";
import { saveTender } from "../server/tender.ts";
import { verifyIntegrity } from "../server/integrity.ts";
import { backupDatabase } from "../scripts/backup.ts";
import { workforceCommand } from "../server/workforce.ts";
import { randomBytes, createHash } from "node:crypto";
import type { Role, User } from "../src/model.ts";

function fixture(path=":memory:") {
  const store=new Store(path);
  const add=(name:string,role:Role):User=>({id:store.addUser(name,"synthetic-password",role),name,role,company:"Synthetic"});
  const manager=add("access-manager","manager"), engineer=add("access-engineer","engineer"), viewer=add("access-viewer","viewer"), supervisor=add("access-supervisor","supervisor");
  const a=store.project(manager,{name:"Assigned roof"}),b=store.project(manager,{name:"Unassigned private roof"});
  const grant=(who:User,permission:string,pid=a.id,previousId:string|null=null)=>store.setProjectAccess(manager,pid,{userId:who.id,permission,previousId,reason:"Synthetic access review"});
  return {store,manager,engineer,viewer,supervisor,a,b,grant};
}
test("staff are denied by default; assignments scope projects and records; viewers cannot gain edit rights",()=>{
  const f=fixture();try {
    const {store,manager,engineer,viewer,a,b,grant}=f;
    saveRecord(store,manager,a.id,"load",{thickness:18,density:650,area:100,other:0});
    saveRecord(store,manager,b.id,"load",{thickness:18,density:650,area:200,other:0});
    assert.deepEqual(store.snapshot(engineer).projects,[]);
    assert.throws(()=>saveRecord(store,engineer,a.id,"load",{}),/Forbidden/);
    grant(engineer,"read");
    assert.deepEqual(store.snapshot(engineer).projects.map(p=>p.id),[a.id]);
    assert.equal(store.snapshot(engineer).permissions?.[a.id],"read");
    assert.ok(store.snapshot(engineer).records.every(r=>r.pid===a.id));
    assert.throws(()=>saveRecord(store,engineer,a.id,"load",{}),/project edit/);
    assert.throws(()=>grant(viewer,"edit"),/Invalid permission/);
    grant(viewer,"read");
    assert.equal(documentState(store,viewer,a.id).canWrite,false);
    assert.throws(()=>store.setProjectAccess(engineer,a.id,{userId:viewer.id,permission:"read",reason:"Unauthorised grant"}),/Forbidden/);
    assert.equal(store.snapshot(manager).projects.length,2);
  }finally{f.store.close();}
});
test("access changes preserve history, reject stale writers, revoke immediately and survive restart",()=>{
  const dir=mkdtempSync(join(tmpdir(),"jr-access-")),path=join(dir,"access.sqlite"),f=fixture(path);
  try {
    const first=f.grant(f.engineer,"edit");
    const revoked=f.grant(f.engineer,"none",f.a.id,first.id);
    assert.equal(f.store.projectPermission(f.engineer,f.a.id),null);
    assert.throws(()=>f.grant(f.engineer,"edit",f.a.id,first.id),/Access changed/);
    assert.equal(f.store.projectAccessState(f.manager,f.a.id).history.length,2);
    verifyIntegrity(f.store.db);
    const backup=join(dir,"verified-backup.sqlite");backupDatabase(path,backup);
    f.store.close();
    for (const location of [path,backup]) {
      const restored=new Store(location);
      try {
        assert.equal(restored.projectPermission(f.engineer,f.a.id),null);
        assert.equal(restored.projectAccessState(f.manager,f.a.id).history[1].id,revoked.id);
        assert.throws(()=>documentState(restored,f.engineer,f.a.id),/Forbidden/);
      }finally{restored.close();}
    }
  }finally{try{f.store.close();}catch{}rmSync(dir,{recursive:true,force:true});}
});
test("read-only document access rejects revisions and direct image writes without leaving evidence",()=>{
  const f=fixture();try{
    const {store,manager,engineer,a,grant}=f;
    const source=documentCommand(store,manager,a.id,"source",{title:"Source",reference:"S",content:"Synthetic text"});
    const first=grant(engineer,"edit");
    const draft=documentCommand(store,engineer,a.id,"draft",{type:"RAMS",title:"Synthetic draft",sources:[{recordId:source.id,excerpt:"Synthetic"}],proposals:"Synthetic controls",limitations:"Synthetic gaps"});
    const second=grant(engineer,"read",a.id,first.id);
    assert.equal(documentState(store,engineer,a.id).canWrite,false);
    assert.throws(()=>documentCommand(store,engineer,a.id,"draft",{replaces:draft.id}),/project edit/);
    const before=store.db.prepare("SELECT count(*) n FROM evidence").get()!.n;
    assert.throws(()=>saveTender(store,engineer,a.id,"photo",{image:"data:image/png;base64,"+readFileSync("tests/fixtures/roof.png").toString("base64")}),/project edit/);
    assert.equal(store.db.prepare("SELECT count(*) n FROM evidence").get()!.n,before);
    grant(engineer,"none",a.id,second.id);
    assert.throws(()=>documentState(store,engineer,a.id),/project read/);
  }finally{f.store.close();}
});
test("HTTP scopes snapshots, document PDFs, dossiers, assignments and immediate revocation",async()=>{
  const f=fixture(),server=createApp(f.store);
  await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  const login=async(name:string)=>{const r=await fetch(base+"/api/login",{method:"POST",headers:{Origin:base,"Content-Type":"application/json"},body:JSON.stringify({name,password:"synthetic-password"})});return r.headers.get("set-cookie")!.split(";")[0];};
  try{
    const {store,manager,engineer,a,b,grant}=f;
    const source=documentCommand(store,manager,b.id,"source",{title:"Private source",reference:"P",content:"Private evidence"});
    const doc=documentCommand(store,manager,b.id,"draft",{type:"CPP",title:"Private CPP",sources:[{recordId:source.id,excerpt:"Private"}],proposals:"Private draft",limitations:"Private gaps"});
    const cookie=await login(engineer.name),first=grant(engineer,"read");
    const get=(path:string)=>fetch(base+"/api/"+path,{headers:{Cookie:cookie}});
    const bytes=readFileSync("tests/fixtures/roof.png");
    for(const [id,pid] of [["staff-photo",a.id],["private-photo",b.id],["workforce-photo",a.id]])store.db.prepare("INSERT INTO evidence VALUES(?,?,?,?,?)").run(id,pid,"image/png",bytes,createHash("sha256").update(bytes).digest("hex"));
    store.transaction(()=>{
      store.append(manager,a.id,"workforce.daily-report",{workerId:"synthetic-worker",evidence:[{assetId:"workforce-photo"}]});
      store.append(manager,a.id,"commercial.cost",{description:"Private commercial sentinel"});
    });
    assert.equal((await get("evidence/staff-photo")).status,200);
    assert.equal((await get("evidence/private-photo")).status,404);
    assert.equal((await get("evidence/workforce-photo")).status,404);
    for(const path of [`document-intelligence?pid=${b.id}`,`document-pdf?pid=${b.id}&id=${doc.id}`,`project-access?pid=${a.id}`]) assert.equal((await get(path)).status,403);
    assert.equal((await get(`dossiers/${b.id}`)).status,404);
    const dossier=await get(`dossiers/${a.id}`);assert.equal(dossier.status,200);
    assert.ok(!(await dossier.text()).includes("Private commercial sentinel"),"Commercial audit must remain manager-only");
    const state=await (await get("state")).json() as any;
    assert.equal(state.projects.length,1);assert.ok(!JSON.stringify(state).includes("Private evidence"));
    grant(engineer,"none",a.id,first.id);
    assert.equal((await (await get("state")).json() as any).projects.length,0);
    assert.equal((await get(`dossiers/${a.id}`)).status,404);
    assert.equal((await get(`document-intelligence?pid=${a.id}`)).status,403);
  }finally{await new Promise<void>(r=>server.close(()=>r()));f.store.close();}
});
test("document revisions preserve all sources, need fresh review and reject concurrent edits",()=>{
  const f=fixture();try{
    const {store,manager,engineer,a,grant}=f;grant(engineer,"edit");
    const sources=["Source A","Source B"].map(content=>documentCommand(store,manager,a.id,"source",{title:content,reference:content,content}));
    const data={type:"CPP",title:"Versioned CPP",sources:sources.map(r=>({recordId:r.id,excerpt:r.data.content})),proposals:"Original controls",limitations:"Original gaps"};
    const first=documentCommand(store,engineer,a.id,"draft",data);
    documentCommand(store,manager,a.id,"review",{documentId:first.id,decision:"accepted",...reviewPayload("CPP"),attest:true,note:"Independent original review"});
    const next=documentCommand(store,engineer,a.id,"draft",{...data,replaces:first.id,proposals:"Revised controls"});
    assert.equal(next.data.version,2);assert.deepEqual(next.data.sources.map((s:any)=>s.recordId),sources.map(s=>s.id));
    const state=documentState(store,manager,a.id);assert.equal(state.documents[0].status,"Superseded");assert.match(state.documents[1].status,/Draft/);
    assert.throws(()=>documentCommand(store,engineer,a.id,"draft",{...data,replaces:first.id}),/Current revision/);
    assert.equal(documentState(store,manager,a.id).documents.length,2);
    assert.equal(first.data.proposals,"Original controls");
    // Staff assignments are separate from document evidence: grants do not rewrite project snapshots.
    assert.deepEqual(store.snapshot(manager).projects.find(p=>p.id===a.id),a);
    verifyIntegrity(store.db);
  }finally{f.store.close();}
});
test("workforce supervisor allocation grants no document access; document grants grant no workforce authority",()=>{
  const f=fixture();try{
    const {store,manager,engineer,supervisor,a,grant}=f;
    workforceCommand(store,manager,a.id,"config",{latitude:51,longitude:0,radiusMetres:100,supervisors:[supervisor.id],syntheticOnly:true},randomBytes(32));
    assert.equal(store.snapshot(supervisor).permissions?.[a.id],"workforce");
    assert.deepEqual(store.snapshot(supervisor).records,[]);
    assert.throws(()=>documentState(store,supervisor,a.id),/project read/);
    grant(engineer,"edit");
    assert.throws(()=>workforceCommand(store,engineer,a.id,"challenge",{},randomBytes(32)),/Forbidden/);
  }finally{f.store.close();}
});
