import test from "node:test";
import assert from "node:assert/strict";
import { comparisonFixture } from "./workforce-comparison-fixture.ts";
import { plannedActualCsv } from "../src/workforce-csv.ts";
import { verifyIntegrity } from "../server/integrity.ts";
import { createApp } from "../server/index.ts";
import { Store } from "../server/store.ts";
import { workforceState } from "../server/workforce.ts";
import { backupDatabase } from "../scripts/backup.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("planned hours never imply attendance; completed shifts retain exact UTC times, breaks and review references",()=>{
  const f=comparisonFixture();try{
    f.plan();assert.equal(f.state().comparison.totals.plannedHours,7.5);assert.equal(f.state().comparison.totals.verifiedHours,0);
    f.attendance(f.worker,false);const pending=f.state();assert.equal(pending.comparison.rows[0].actual,null);assert.equal(pending.report[0].verifiedHours,0);assert.equal(pending.report[0].pending,1);
    const finish=pending.records.filter(r=>r.kind==="workforce.event").at(-1)!;
    f.cmd(f.supervisor,"review",{eventId:finish.id,decision:"accepted",reason:"Verified finish",correctedAt:"2026-10-26T15:30:00Z"});
    const shift=f.state().report[0].shifts[0];assert.equal(shift.start,"2026-10-26T08:00:00.000Z");assert.equal(shift.end,"2026-10-26T15:30:00.000Z");assert.equal(shift.breakMinutes,30);assert.equal(shift.hours,7);assert.equal(shift.eventIds.length,4);assert.equal(shift.reviewIds.length,4);
  }finally{f.store.close();}
});
test("unique overlaps need an explicit independent supervisor decision and never alter verified hours",()=>{
  const f=comparisonFixture();try{
    f.plan();f.attendance();const row=f.state().comparison.rows[0];assert.equal(row.matchStatus,"Awaiting supervisor confirmation");assert.equal(row.varianceHours,-0.5);
    for(const who of [f.worker,f.owner,f.unassigned])assert.throws(()=>f.cmd(who,"match",f.matching(row)),/Forbidden/);
    assert.throws(()=>f.cmd(f.supervisor,"match",f.matching(row,{attest:false})),/attestation/);
    f.cmd(f.supervisor,"match",f.matching(row));const state=f.state();assert.equal(state.comparison.totals.confirmedMatches,1);assert.equal(state.comparison.totals.confirmedVerifiedHours,7);assert.equal(state.comparison.totals.confirmedVarianceHours,-0.5);assert.equal(state.comparison.unconfirmedAttendance.length,0);assert.equal(state.report[0].verifiedHours,7);assert.equal(state.report[0].amount,140);verifyIntegrity(f.store.db);
  }finally{f.store.close();}
});
test("attendance corrections invalidate confirmations even when the same event remains matched",()=>{
  const f=comparisonFixture();try{
    f.plan();const events=f.attendance();const old=f.state().comparison.rows[0];f.cmd(f.supervisor,"match",f.matching(old));
    f.cmd(f.supervisor,"review",{eventId:events.at(-1).id,decision:"accepted",reason:"Corrected independent finish evidence",correctedAt:"2026-10-26T15:45:00Z"});
    let row=f.state().comparison.rows[0];assert.equal(row.matchStatus,"Stale — recheck required");assert.equal(row.verifiedHours,7.25);assert.equal(f.state().comparison.totals.confirmedMatches,0);
    assert.throws(()=>f.cmd(f.supervisor,"match",f.matching(row,{inputFingerprint:old.inputFingerprint})),/attendance changed/);
    f.cmd(f.supervisor,"match",f.matching(row));row=f.state().comparison.rows[0];assert.equal(row.matchStatus,"Confirmed");assert.equal(row.varianceHours,-0.25);
  }finally{f.store.close();}
});
test("plan revisions, cancellations and conflicting match decisions cannot preserve or overwrite stale confirmation",()=>{
  const f=comparisonFixture();try{
    const plan=f.plan();f.attendance();const old=f.state().comparison.rows[0];f.cmd(f.supervisor,"match",f.matching(old));
    assert.throws(()=>f.cmd(f.manager,"match",f.matching(old)),/match changed/);
    const revised=f.plan(f.worker,{replaces:plan.id,start:"2026-10-26T07:30:00Z"});let row=f.state().comparison.rows[0];assert.equal(row.matchStatus,"Stale — recheck required");
    assert.throws(()=>f.cmd(f.supervisor,"match",f.matching(old)),/current unique/);
    f.cmd(f.supervisor,"match",f.matching(row,{decision:"rejected"}));row=f.state().comparison.rows[0];assert.equal(row.matchStatus,"Rejected");assert.equal(f.state().comparison.totals.verifiedHours,7);
    f.cmd(f.manager,"cancel-shift",{replaces:revised.id,reason:"Synthetic cancellation"});const result=f.state().comparison;assert.equal(result.rows.length,0);assert.equal(result.totals.confirmedMatches,0);assert.equal(result.unconfirmedAttendance.length,1);assert.equal(result.totals.verifiedHours,7);
  }finally{f.store.close();}
});
test("ambiguous overlaps cannot reuse one verified shift across two plans",()=>{
  const f=comparisonFixture();try{
    f.plan(f.worker,{end:"2026-10-26T12:00:00Z",breakMinutes:0});f.plan(f.worker,{start:"2026-10-26T12:00:00Z"});f.attendance();const c=f.state().comparison;
    assert.ok(c.rows.every(r=>r.actual===null&&r.matchStatus.startsWith("Ambiguous")));assert.equal(c.totals.verifiedHours,7);assert.equal(c.unconfirmedAttendance.length,1);
    assert.throws(()=>f.cmd(f.supervisor,"match",f.matching(c.rows[0])),/unique verified/);
    assert.equal(plannedActualCsv(c).split("\r\n").filter(line=>line.startsWith('"Verified attendance without a unique plan candidate"')).length,1);
  }finally{f.store.close();}
});
test("company scope excludes other companies and CSV preserves numeric variance without duplicating candidates",()=>{
  const f=comparisonFixture();try{
    f.plan();f.plan(f.other);f.attendance();f.attendance(f.other);const owner=f.state(f.owner);assert.equal(owner.comparison.rows.length,1);assert.equal(owner.comparison.totals.verifiedHours,7);assert.ok(!JSON.stringify(owner.comparison).includes(f.other.id));assert.ok(!JSON.stringify(owner.comparison).includes('"latitude"'));
    const csv=plannedActualCsv(owner.comparison);assert.equal(csv.split("\r\n").length,3,"One header and one plan row; candidate attendance is not duplicated");assert.ok(csv.includes('"-0.5"'));assert.ok(!csv.includes("'-0.5"));
    const formula=plannedActualCsv({...owner.comparison,rows:[{...owner.comparison.rows[0],workerId:'=HYPERLINK("bad")'}]});assert.ok(formula.includes('"\'=HYPERLINK(""bad"")"'));
  }finally{f.store.close();}
});
test("HTTP match actions enforce workforce scope and stale input fingerprints",async()=>{
  const f=comparisonFixture();f.plan();f.attendance();const server=createApp(f.store);await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
  try{
    const row=f.state().comparison.rows[0];
    for(const [actor,data,status] of [[f.owner,f.matching(row),403],[f.supervisor,f.matching(row,{inputFingerprint:"stale"}),400]] as const){const token=f.store.login(actor.name,"synthetic-password");const response=await fetch(base+"/api/workforce",{method:"POST",headers:{Origin:base,"Content-Type":"application/json",Cookie:"jr_session="+token},body:JSON.stringify({pid:f.pid,action:"match",data})});assert.equal(response.status,status);}
    assert.equal(f.state().comparison.totals.confirmedMatches,0);
  }finally{await new Promise<void>(r=>server.close(()=>r()));f.store.close();}
});
test("confirmed match history and exact evidence fingerprints survive verified backup restore",()=>{
  const dir=mkdtempSync(join(tmpdir(),"jr-matches-")),path=join(dir,"source.sqlite"),f=comparisonFixture(path);
  try{
    f.plan();f.attendance();const row=f.state().comparison.rows[0];const match=f.cmd(f.supervisor,"match",f.matching(row));
    const backup=join(dir,"backup.sqlite");backupDatabase(path,backup);const restored=new Store(backup);
    try{const state=workforceState(restored,f.manager,f.pid);assert.equal(state.comparison.rows[0].inputFingerprint,row.inputFingerprint);assert.equal(state.comparison.rows[0].latestMatch?.id,match.id);assert.equal(state.comparison.totals.confirmedMatches,1);assert.equal(state.comparison.totals.confirmedVerifiedHours,7);verifyIntegrity(restored.db);}finally{restored.close();}
  }finally{f.store.close();rmSync(dir,{recursive:true,force:true});}
});
