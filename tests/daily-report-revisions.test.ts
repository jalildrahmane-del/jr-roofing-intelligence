import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Store} from '../server/store.ts';
import {workforceCommand,workforceState} from '../server/workforce.ts';
import {returnedDailyReports} from '../src/daily-report-revisions.ts';
import {readDailyDraft} from '../src/daily-report-draft.ts';
import type {User,Role,RecordItem} from '../src/model.ts';
const photo={image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',caption:'Original evidence'};
function fixture(){
 const store=new Store(':memory:'),key=randomBytes(32);
 const add=(name:string,role:Role):User=>({id:store.addUser(name,'test-password',role),name,role,company:'Main'});
 const manager=add('manager','manager'),supervisor=add('supervisor','supervisor'),worker=add('worker','worker'),other=add('other','worker');
 const pid=store.project(manager,{name:'Daily revision test'}).id;
 const cmd=(u:User,a:string,d:any)=>workforceCommand(store,u,pid,a,d,key) as RecordItem;
 cmd(manager,'config',{latitude:51,longitude:0,radiusMetres:100,supervisors:[supervisor.id],syntheticOnly:true});
 for(const w of [worker,other])cmd(manager,'allocation',{workerId:w.id,active:true,rate:20,shift:'Day'});
 const data={day:'2026-11-01',completed:'Original roof work',delays:'None',nextShift:'Continue',operatives:2,workAreas:'West roof',conditions:'Dry',photos:[photo]};
 const original=cmd(worker,'daily-report',data);
 const revision={...data,completed:'Corrected roof work',replacesReportId:original.id,retainedPhotoIds:[original.data.evidence[0].assetId],photos:[]};
 return{store,key,manager,supervisor,worker,other,pid,cmd,data,original,revision};
}
test('returned reports create linear immutable revisions, retain photos and require fresh review',()=>{
 const f=fixture();try{
  assert.throws(()=>f.cmd(f.worker,'daily-report',f.revision),/Only returned/);
  f.cmd(f.supervisor,'daily-review',{reportId:f.original.id,decision:'returned',reason:'Clarify work area'});
  assert.equal(returnedDailyReports(workforceState(f.store,f.worker,f.pid).records,f.worker.id).length,1);
  assert.ok(workforceState(f.store,f.worker,f.pid).actions.some(a=>a.kind==='returned'));
  const revision=f.cmd(f.worker,'daily-report',f.revision);
  assert.equal(revision.data.replacesReportId,f.original.id);
  assert.deepEqual(revision.data.evidence,f.original.data.evidence);
  assert.equal((f.store.db.prepare('SELECT COUNT(*) AS n FROM evidence').get() as any).n,1,'Retaining evidence must not create duplicate binary assets');
  const records=workforceState(f.store,f.worker,f.pid).records;
  assert.equal(records.find(r=>r.id===f.original.id)?.data.completed,'Original roof work');
  assert.equal(returnedDailyReports(records,f.worker.id).length,0);
  assert.ok(!workforceState(f.store,f.worker,f.pid).actions.some(a=>a.kind==='returned'));
  assert.ok(workforceState(f.store,f.supervisor,f.pid).actions.some(a=>a.recordId===revision.id&&a.kind==='review'));
  assert.throws(()=>f.cmd(f.worker,'daily-report',f.revision),/already been resubmitted/);
  assert.throws(()=>f.cmd(f.worker,'daily-review',{reportId:revision.id,decision:'accepted',reason:'Self'}),/Forbidden/);
  f.cmd(f.supervisor,'daily-review',{reportId:revision.id,decision:'returned',reason:'Add clarification'});
  const second=f.cmd(f.worker,'daily-report',{...f.revision,replacesReportId:revision.id,photos:[{...photo,caption:'New supporting evidence'}],retainedPhotoIds:[]});
  f.cmd(f.supervisor,'daily-review',{reportId:second.id,decision:'accepted',reason:'Checked corrected report'});
  assert.throws(()=>f.cmd(f.worker,'daily-report',{...f.revision,replacesReportId:second.id,retainedPhotoIds:[second.data.evidence[0].assetId]}),/Only returned/);
 }finally{f.store.close();}
});
test('revision author, worker/date, project, asset provenance and combined photo limits are enforced atomically',()=>{
 const f=fixture();try{
  f.cmd(f.supervisor,'daily-review',{reportId:f.original.id,decision:'returned',reason:'Clarify'});
  const other=f.cmd(f.other,'daily-report',f.data);
  const before=(f.store.db.prepare('SELECT COUNT(*) AS n FROM evidence').get() as any).n;
  for(const patch of [{day:'2026-11-02'},{retainedPhotoIds:[other.data.evidence[0].assetId]},{retainedPhotoIds:[f.original.data.evidence[0].assetId,f.original.data.evidence[0].assetId]},{photos:Array(4).fill(photo)},{completed:''},{replacesReportId:'missing'}]){
   assert.throws(()=>f.cmd(f.worker,'daily-report',{...f.revision,...patch}));
   assert.equal((f.store.db.prepare('SELECT COUNT(*) AS n FROM evidence').get() as any).n,before);
  }
  assert.throws(()=>f.cmd(f.manager,'daily-report',{...f.revision,workerId:f.worker.id}),/original author/);
  assert.throws(()=>f.cmd(f.other,'daily-report',f.revision),/original author/);
  assert.throws(()=>f.cmd(f.worker,'daily-report',{...f.revision,replacesReportId:undefined}),/require a returned original/);
  const otherPid=f.store.project(f.manager,{name:'Different project'}).id;
  workforceCommand(f.store,f.manager,otherPid,'config',{latitude:51,longitude:0,radiusMetres:100,supervisors:[],syntheticOnly:true},f.key);
  workforceCommand(f.store,f.manager,otherPid,'allocation',{workerId:f.worker.id,active:true,rate:20,shift:'Day'},f.key);
  assert.throws(()=>workforceCommand(f.store,f.worker,otherPid,'daily-report',f.revision,f.key),/original author/);
  f.cmd(f.manager,'allocation',{workerId:f.worker.id,active:false,rate:20,shift:'Day'});
  assert.throws(()=>f.cmd(f.worker,'daily-report',f.revision),/Forbidden/);
 }finally{f.store.close();}
});
test('revision drafts preserve original links and retained photo references; corrupt references reject',()=>{
 const draft={version:1,savedAt:'2026-11-06T12:00:00Z',fields:{day:'2026-11-01',replacesReportId:'original',retainedPhotoIds:'["asset"]',completed:'Correction'},photos:[]};
 assert.deepEqual(readDailyDraft(JSON.stringify(draft)),draft);
 for(const raw of ['broken','{}','["asset","asset"]','[null]'])assert.throws(()=>readDailyDraft(JSON.stringify({...draft,fields:{...draft.fields,retainedPhotoIds:raw}})));
});
