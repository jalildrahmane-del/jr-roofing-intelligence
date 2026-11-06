import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Store} from '../server/store.ts';
import {workforceCommand,workforceState,workforceDirectorSummary} from '../server/workforce.ts';
import {workforceActions,workforceActionLink} from '../src/workforce-actions.ts';
import type {User,Role,RecordItem} from '../src/model.ts';
function fixture(){
 const store=new Store(':memory:'),key=randomBytes(32);
 const add=(name:string,role:Role,company='Alpha'):User=>({id:store.addUser(name,'test-password',role,company),name,role,company});
 const manager=add('manager','manager'),supervisor=add('supervisor','supervisor'),worker=add('worker','worker'),other=add('other','worker','Beta'),owner=add('owner','subcontractor-owner');
 const pid=store.project(manager,{name:'Action test'}).id;
 const cmd=(user:User,action:string,data:any)=>workforceCommand(store,user,pid,action,data,key) as RecordItem;
 cmd(manager,'config',{latitude:51,longitude:0,radiusMetres:100,supervisors:[supervisor.id],syntheticOnly:true});
 for(const w of [worker,other])cmd(manager,'allocation',{workerId:w.id,active:true,shift:'Day',rate:20});
 cmd(manager,'owner',{ownerId:owner.id,active:true});
 const data={description:'Insulation',specification:'Test board',quantity:4,unit:'packs',neededBy:'2026-11-03',deliveryPoint:'Compound',reason:'Next shift',priority:'urgent'};
 const request=cmd(worker,'material-request',data);
 return {store,cmd,pid,manager,supervisor,worker,other,owner,data,request};
}
test('actions advance review to order to outstanding receipt and disappear at full receipt',()=>{
 const f=fixture();try{
  const actions=()=>workforceState(f.store,f.manager,f.pid).actions;
  assert.equal(actions()[0].kind,'review');
  f.cmd(f.supervisor,'material-review',{requestId:f.request.id,decision:'approved',reason:'Checked'});
  assert.equal(actions()[0].kind,'order');
  const order=f.cmd(f.manager,'material-order',{requestId:f.request.id,supplier:'Test',orderReference:'PO-1',expectedDate:'2026-11-03',evidence:'Confirmation',attest:true});
  assert.equal(actions()[0].kind,'delivery');
  const receipt={requestId:f.request.id,previousId:order.id,deliveredOn:new Date().toISOString().slice(0,10),acceptedQuantity:1,damagedQuantity:1,deliveryReference:'DN-1',notes:'One damaged',attest:true};
  const first=f.cmd(f.supervisor,'material-delivery',receipt);
  assert.match(actions()[0].detail,/3 packs outstanding/);
  f.cmd(f.supervisor,'material-delivery',{...receipt,previousId:first.id,acceptedQuantity:3,damagedQuantity:0});
  assert.deepEqual(actions(),[]);
  assert.deepEqual(workforceDirectorSummary(f.store,f.manager)[0].actions,[]);
 }finally{f.store.close();}
});
test('independent eligibility, worker/company isolation and permission revocation apply to actions',()=>{
 const f=fixture();try{
  const own=f.cmd(f.manager,'material-request',{...f.data,workerId:f.worker.id});
  const beta=f.cmd(f.other,'material-request',{...f.data,description:'Private Beta request'});
  const m=workforceState(f.store,f.manager,f.pid).actions;
  assert.equal(m.find(a=>a.recordId===own.id)?.kind,'waiting');
  assert.equal(workforceState(f.store,f.supervisor,f.pid).actions.find(a=>a.recordId===own.id)?.kind,'review');
  for(const u of [f.worker,f.owner]){
   const actions=workforceState(f.store,u,f.pid).actions;
   assert.ok(!JSON.stringify(actions).includes(beta.id));assert.ok(actions.every(a=>a.kind==='waiting'));
  }
  f.cmd(f.supervisor,'material-review',{requestId:f.request.id,decision:'rejected',reason:'Not needed'});
  assert.ok(!workforceState(f.store,f.manager,f.pid).actions.some(a=>a.recordId===f.request.id));
  f.cmd(f.manager,'owner',{ownerId:f.owner.id,active:false});assert.throws(()=>workforceState(f.store,f.owner,f.pid),/Forbidden/);
 }finally{f.store.close();}
});
test('urgent and overdue priority uses explicit dates; deep links retain exact project and record',()=>{
 const user={id:'manager',role:'manager',name:'Manager',company:'Main'} as User;
 const request=(id:string,priority:string,day:string):RecordItem=>({id,pid:'project',kind:'workforce.material-request',author:'worker',createdAt:'2026-11-01T10:00:00Z',data:{workerId:'worker',priority,neededBy:day,description:id,quantity:1,unit:'packs'}});
 const a=request('urgent','urgent','2026-11-06'),b=request('late','normal','2026-11-04');
 const records=[a,b,...[a,b].map(r=>({...r,id:'review-'+r.id,kind:'workforce.material-review',data:{requestId:r.id,decision:'approved'}}))];
 const actions=workforceActions(records,user,'2026-11-06');
 assert.equal(actions[0].recordId,'late');assert.equal(actions[0].overdue,true);assert.equal(actions[1].overdue,false);assert.equal(actions[1].urgent,true);
 const link=new URL(workforceActionLink('p & 1',actions[1]),'https://test.invalid/');
 assert.equal(link.searchParams.get('site'),'p & 1');assert.equal(link.searchParams.get('record'),'urgent');assert.equal(link.hash,'#workforce');
});
test('latest attendance decisions and completed daily reviews clear only eligible review reminders',()=>{
 const user={id:'manager',role:'manager',name:'Manager',company:'Main'} as User;
 const event:RecordItem={id:'event',pid:'p',kind:'workforce.event',author:'worker',createdAt:'2026-11-06',data:{workerId:'worker',event:'in'}};
 const daily:RecordItem={...event,id:'daily',kind:'workforce.daily-report',data:{workerId:'worker',day:'2026-11-06',completed:'Roof works'}};
 assert.equal(workforceActions([event,daily],user).length,2);
 const reviews=[{...event,id:'review',kind:'workforce.review',data:{eventId:'event',decision:'accepted'}},{...event,id:'daily-review',kind:'workforce.daily-review',data:{reportId:'daily',decision:'returned'}}];
 assert.deepEqual(workforceActions([event,daily,...reviews],user),[]);
 assert.deepEqual(workforceActions([{...event,author:'manager'}, {...daily,author:'manager'}],user),[]);
});
