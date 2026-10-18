import {test} from 'node:test';import assert from 'node:assert/strict';import {Store} from '../server/store.ts';import {createApp} from '../server/index.ts';import {request} from 'node:http';

test('HTTP contract: role enforcement, server-owned records, malformed input, session revocation and throttling',async()=>{
 const s=new Store(':memory:');for(const role of ['manager','worker','viewer','engineer','supervisor'] as const)s.addUser(role,'integration-password',role);
 const server=createApp(s);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
 const send=(path:string,data:unknown,cookie='')=>fetch(base+'/api/'+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)});
 const login=async(name:string)=>{const r=await send('login',{name,password:'integration-password'});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie')!,/HttpOnly; SameSite=Strict/);return r.headers.get('set-cookie')!.split(';')[0]};
 try{
 for(const body of [null,[],true])assert.equal((await send('projects',body)).status,400);
 assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{bad'})).status,400);
 assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'text/plain'},body:'{}'})).status,415);
 const manager=await login('manager'),worker=await login('worker'),viewer=await login('viewer');
 const payload={name:'Roof <script>test</script>',client:'Test client',address:'Test site',area:94,type:'Commercial',roof:'Flat'};
 for(const cookie of [worker,viewer])assert.equal((await send('projects',payload,cookie)).status,403);
 const response=await send('projects',{...payload,id:'FORGED',status:'Approved'},manager);assert.equal(response.status,201);const project=await response.json() as any;assert.notEqual(project.id,'FORGED');assert.equal(project.status,'Pre-construction');
 const record={pid:project.id,kind:'load',data:{thickness:18,density:650,area:94,other:0,status:'Approved',createdAt:'1999-01-01'}};
 assert.equal((await send('records',record,worker)).status,404);
 assert.equal((await send('records',record,viewer)).status,403);
 assert.equal((await send('records',{...record,pid:'unknown'},manager)).status,404);
 const calculated=await (await send('records',record,manager)).json() as any;assert.equal(calculated.data.status,'Preliminary / Not approved');assert.ok(new Date(calculated.createdAt).getFullYear()>=2026);
 for(const role of ['engineer','supervisor'])assert.equal((await send('records',record,await login(role))).status,201);
 assert.equal((await send('records',{...record,kind:'approval'},manager)).status,400);
 assert.equal((await fetch(base+'/api/state',{headers:{Cookie:worker}}).then(r=>r.json()) as any).records.length,0);
 assert.equal((await fetch(base+'/api/state',{headers:{Cookie:worker}}).then(r=>r.json()) as any).projects.length,0);
 const hash=s.db.prepare('SELECT hash FROM sessions LIMIT 1').get()?.hash;assert.equal(typeof hash,'string');assert.notEqual(hash,manager.slice('jr_session='.length));
 await send('logout',{},manager);assert.equal((await fetch(base+'/api/state',{headers:{Cookie:manager}})).status,401);
 for(let i=0;i<10;i++)assert.equal((await send('login',{name:'absent',password:'invalid-password'})).status,401);
 assert.equal((await send('login',{name:'absent',password:'invalid-password'})).status,429);
 const hostile=await new Promise<number>(r=>{const req=request(base+'/legacy/',{headers:{Host:'attacker.example'}},res=>{res.resume();r(res.statusCode!)});req.end()});assert.equal(hostile,403);
 const malformed=await fetch(base+'/%FF');assert.equal(malformed.status,400);assert.equal((await fetch(base+'/')).status,200);
 }finally{await new Promise<void>(r=>server.close(()=>r()));s.close();}
});
