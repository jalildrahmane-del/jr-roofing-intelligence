import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Store} from '../server/store.ts';
import {createApp} from '../server/index.ts';
import {workforceCommand} from '../server/workforce.ts';
import type {User,Role,RecordItem} from '../src/model.ts';
const photo={image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',caption:'Roof materials'};
function fixture(){
 const store=new Store(':memory:'),key=randomBytes(32);
 const add=(name:string,role:Role,company='Alpha'):User=>({id:store.addUser(name,'test-password',role,company),name,role,company});
 const manager=add('manager','manager'),worker=add('worker','worker'),other=add('other','worker','Beta'),owner=add('owner','subcontractor-owner'),supervisor=add('supervisor','supervisor'),outsider=add('outsider','supervisor');
 const pid=store.project(manager,{name:'Photo test'}).id;
 const cmd=(actor:User,action:string,data:any)=>workforceCommand(store,actor,pid,action,data,key) as RecordItem;
 cmd(manager,'config',{latitude:51,longitude:0,radiusMetres:100,supervisors:[supervisor.id],syntheticOnly:true});
 for(const w of [worker,other])cmd(manager,'allocation',{workerId:w.id,active:true,rate:20,shift:'Day'});
 cmd(manager,'owner',{ownerId:owner.id,active:true});
 const requestData={description:'Insulation',specification:'Specified board',quantity:4,unit:'packs',neededBy:'2026-11-03',deliveryPoint:'Compound',reason:'Work tomorrow',priority:'urgent',photos:[photo]};
 const request=cmd(worker,'material-request',requestData);
 cmd(supervisor,'material-review',{requestId:request.id,decision:'approved',reason:'Checked'});
 const order=cmd(manager,'material-order',{requestId:request.id,supplier:'Supplier',orderReference:'PO-1',expectedDate:'2026-11-03',evidence:'Order confirmation',attest:true});
 const deliveryData={requestId:request.id,previousId:order.id,deliveredOn:new Date().toISOString().slice(0,10),acceptedQuantity:2,damagedQuantity:1,deliveryReference:'DN-1',notes:'One pack damaged',attest:true,photos:[{...photo,caption:'Damaged pack'}]};
 return{store,cmd,manager,worker,other,owner,supervisor,outsider,pid,request,requestData,deliveryData};
}
test('priority and request/receipt photos persist; malformed payloads roll back evidence',()=>{
 const f=fixture();try{
  assert.equal(f.request.data.priority,'urgent');assert.equal(f.request.data.evidence.length,1);
  const before=f.store.db.prepare('SELECT COUNT(*) AS n FROM evidence').get() as any;
  for(const patch of [{priority:'critical'},{photos:null},{photos:Array(5).fill(photo)},{photos:[photo,{...photo,caption:''}]},{photos:[{...photo,image:'data:text/html;base64,YQ=='}]},{description:''}]){
   assert.throws(()=>f.cmd(f.worker,'material-request',{...f.requestData,...patch}));
   assert.deepEqual(f.store.db.prepare('SELECT COUNT(*) AS n FROM evidence').get(),before);
  }
  assert.throws(()=>f.cmd(f.supervisor,'material-delivery',{...f.deliveryData,notes:''}));
  assert.deepEqual(f.store.db.prepare('SELECT COUNT(*) AS n FROM evidence').get(),before);
  const receipt=f.cmd(f.supervisor,'material-delivery',f.deliveryData);
  assert.equal(receipt.data.evidence[0].caption,'Damaged pack');
  assert.throws(()=>f.cmd(f.supervisor,'material-delivery',f.deliveryData),/changed/);
  const legacy=f.cmd(f.worker,'material-request',{...f.requestData,priority:undefined,photos:undefined});
  assert.equal(legacy.data.priority,'normal');assert.deepEqual(legacy.data.evidence,[]);
 }finally{f.store.close();}
});
test('photo HTTP access follows worker/company scope and revocation, including direct asset URLs',async()=>{
 const f=fixture(),server=createApp(f.store);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${(server.address() as any).port}`;
 const cookies=new Map([f.manager,f.worker,f.other,f.owner,f.supervisor,f.outsider].map(u=>[u.id,'jr_session='+f.store.login(u.name,'test-password')]));
 const get=(u:User|undefined,id:string)=>fetch(base+'/api/evidence/'+id,{headers:u?{Cookie:cookies.get(u.id)!}:{}});
 try{
  const receipt=f.cmd(f.supervisor,'material-delivery',f.deliveryData);
  for(const id of [f.request.data.evidence[0].assetId,receipt.data.evidence[0].assetId]){
   for(const user of [f.manager,f.worker,f.owner,f.supervisor]){const res=await get(user,id);assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'image/png');}
   for(const user of [f.other,f.outsider])assert.equal((await get(user,id)).status,404);
   assert.equal((await get(undefined,id)).status,401);
  }
  const otherRequest=f.cmd(f.other,'material-request',f.requestData);
  assert.equal((await get(f.owner,otherRequest.data.evidence[0].assetId)).status,404);
  f.cmd(f.manager,'owner',{ownerId:f.owner.id,active:false});
  assert.equal((await get(f.owner,f.request.data.evidence[0].assetId)).status,404);
  f.cmd(f.manager,'allocation',{workerId:f.worker.id,active:false,rate:20,shift:'Day'});
  assert.equal((await get(f.worker,f.request.data.evidence[0].assetId)).status,404);
 }finally{await new Promise<void>(r=>server.close(()=>r()));f.store.close();}
});
