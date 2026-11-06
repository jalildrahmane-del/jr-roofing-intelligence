import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Store} from '../server/store.ts';
import {workforceCommand,workforceState,workforceDirectorSummary} from '../server/workforce.ts';
import {materialFulfilment} from '../src/material-fulfilment.ts';
import type {User,Role,RecordItem} from '../src/model.ts';
function fixture(){
  const store=new Store(':memory:'),key=randomBytes(32);
  const add=(name:string,role:Role,company='Alpha'):User=>({id:store.addUser(name,'synthetic-password',role,company),name,role,company});
  const manager=add('manager','manager'),supervisor=add('supervisor','supervisor'),worker=add('worker','worker'),owner=add('owner','subcontractor-owner'),other=add('other','worker','Beta');
  const pid=store.project(manager,{name:'Synthetic roof'}).id;
  const cmd=(user:User,action:string,data:any)=>workforceCommand(store,user,pid,action,data,key) as RecordItem;
  cmd(manager,'config',{latitude:51,longitude:0,radiusMetres:100,supervisors:[supervisor.id],syntheticOnly:true});
  for(const w of [worker,other])cmd(manager,'allocation',{workerId:w.id,active:true,shift:'Day',rate:20});
  cmd(manager,'owner',{ownerId:owner.id,active:true});
  const request=cmd(worker,'material-request',{description:'Roof boards',specification:'Test specification',quantity:10,unit:'packs',neededBy:'2026-12-01',deliveryPoint:'Compound',reason:'Test'});
  const order={requestId:request.id,supplier:'Test supplier',orderReference:'PO-10',expectedDate:'2026-12-01',evidence:'Recorded order confirmation',attest:true};
  const delivery={requestId:request.id,deliveredOn:new Date().toISOString().slice(0,10),deliveryReference:'DN-10',acceptedQuantity:3,damagedQuantity:2,notes:'Two packs damaged; replacements required',attest:true};
  const state=()=>workforceState(store,manager,pid);
  return {store,key,pid,cmd,manager,supervisor,worker,owner,other,request,order,delivery,state};
}
test('materials progress from independent approval through partial/damaged delivery to full receipt',()=>{
  const f=fixture();try{
    assert.throws(()=>f.cmd(f.manager,'material-order',f.order),/approval required/);
    f.cmd(f.supervisor,'material-review',{requestId:f.request.id,decision:'approved',reason:'Checked'});
    assert.throws(()=>f.cmd(f.supervisor,'material-delivery',{...f.delivery,previousId:null}),/Record the order/);
    const order=f.cmd(f.manager,'material-order',f.order);
    assert.equal(materialFulfilment(f.state().records,f.request).status,'Ordered — awaiting delivery');
    assert.throws(()=>f.cmd(f.manager,'material-order',f.order),/already recorded/);
    const receipt=f.cmd(f.supervisor,'material-delivery',{...f.delivery,previousId:order.id});
    let progress=materialFulfilment(f.state().records,f.request);
    assert.equal(progress.received,3);assert.equal(progress.damaged,2);assert.equal(progress.remaining,7);
    assert.equal(progress.status,'Part delivered — balance outstanding');
    assert.equal(workforceDirectorSummary(f.store,f.manager)[0].materialAwaitingDelivery,1);
    assert.throws(()=>f.cmd(f.supervisor,'material-delivery',{...f.delivery,previousId:order.id}),/changed/);
    assert.throws(()=>f.cmd(f.supervisor,'material-delivery',{...f.delivery,previousId:receipt.id,acceptedQuantity:8,damagedQuantity:0}),/exceeds/);
    f.cmd(f.supervisor,'material-delivery',{...f.delivery,previousId:receipt.id,acceptedQuantity:7,damagedQuantity:0,deliveryReference:'DN-11'});
    progress=materialFulfilment(f.state().records,f.request);
    assert.equal(workforceDirectorSummary(f.store,f.manager)[0].materialAwaitingDelivery,0);
    assert.equal(workforceDirectorSummary(f.store,f.manager)[0].materialReceived,1);
    assert.equal(progress.status,'Received in full');assert.equal(progress.remaining,0);assert.equal(progress.deliveries.length,2);
    assert.throws(()=>f.cmd(f.supervisor,'material-delivery',{...f.delivery,previousId:progress.latestId}),/already been received/);
    assert.equal(f.state().records.find(r=>r.id===f.request.id)?.data.quantity,10,'Original request remains unchanged');
  }finally{f.store.close();}
});
test('materials ordering/receipt permissions, project and company boundaries remain enforced',()=>{
  const f=fixture();try{
    f.cmd(f.supervisor,'material-review',{requestId:f.request.id,decision:'approved',reason:'Checked'});
    for(const user of [f.worker,f.owner,f.supervisor])assert.throws(()=>f.cmd(user,'material-order',f.order),/Forbidden/);
    const order=f.cmd(f.manager,'material-order',f.order);
    for(const user of [f.worker,f.owner])assert.throws(()=>f.cmd(user,'material-delivery',{...f.delivery,previousId:order.id}),/Forbidden/);
    const otherPid=f.store.project(f.manager,{name:'Different project'}).id;
    workforceCommand(f.store,f.manager,otherPid,'config',{latitude:51,longitude:0,radiusMetres:100,supervisors:[],syntheticOnly:true},f.key);
    assert.throws(()=>workforceCommand(f.store,f.manager,otherPid,'material-delivery',{...f.delivery,previousId:order.id},f.key),/not found/);
    const own=workforceState(f.store,f.owner,f.pid);assert.ok(own.records.some(r=>r.id===order.id));
    assert.ok(!JSON.stringify(workforceState(f.store,f.other,f.pid)).includes('PO-10'));
    f.cmd(f.manager,'owner',{ownerId:f.owner.id,active:false});assert.throws(()=>workforceState(f.store,f.owner,f.pid),/Forbidden/);
  }finally{f.store.close();}
});
test('invalid and unattested delivery evidence never changes received totals',()=>{
  const f=fixture();try{
    f.cmd(f.supervisor,'material-review',{requestId:f.request.id,decision:'approved',reason:'Checked'});
    assert.throws(()=>f.cmd(f.manager,'material-order',{...f.order,attest:false}),/Confirm/);
    const order=f.cmd(f.manager,'material-order',f.order);
    for(const patch of [{attest:false},{acceptedQuantity:-1},{acceptedQuantity:0,damagedQuantity:0},{acceptedQuantity:Infinity},{deliveredOn:'2026-02-30'},{deliveredOn:'2099-01-01'},{deliveryReference:''},{notes:''}]){
      assert.throws(()=>f.cmd(f.supervisor,'material-delivery',{...f.delivery,previousId:order.id,...patch}));
    }
    assert.equal(materialFulfilment(f.state().records,f.request).deliveries.length,0);
    assert.equal(materialFulfilment(f.state().records,f.request).remaining,10);
  }finally{f.store.close();}
});

test('material balances preserve small quantities and reconcile decimal deliveries',()=>{
  const request={id:'request',pid:'project',kind:'workforce.material-request',author:'worker',createdAt:'2026-11-01',data:{quantity:1e-10}};
  assert.equal(materialFulfilment([],request).remaining,1e-10);
  const deliveries=[0.1,0.2].map((acceptedQuantity,index)=>({id:String(index),pid:'project',kind:'workforce.material-delivery',author:'supervisor',createdAt:'2026-11-01',data:{requestId:'request',acceptedQuantity,damagedQuantity:0}}));
  assert.equal(materialFulfilment(deliveries,{...request,data:{quantity:0.3}}).remaining,0);
});
