import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
import {Store} from '../server/store.ts';
const folder=mkdtempSync(join(tmpdir(),'jr-dev-')),db=join(folder,'dev.sqlite'),s=new Store(db);
s.addUser('dev-test-manager','development-test-password','manager');s.close();
const server=spawn(process.execPath,['scripts/dev.mjs'],{env:{...process.env,JR_DB:db,JR_API_PORT:'4318',JR_WEB_PORT:'4317'},stdio:'pipe'});let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
const base='http://127.0.0.1:4317';
try{
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(base+'/api/me');if(r.status===401){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert.ok(ready,logs);
 const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({name:'dev-test-manager',password:'development-test-password'})});assert.equal(login.status,200,await login.text());
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const state=await fetch(base+'/api/state',{headers:{Cookie:cookie}});assert.equal(state.status,200);
 const csrf=await fetch(base+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example',Cookie:cookie},body:'{}'});assert.equal(csrf.status,403);
 console.log('PASS: npm run dev API proxy, authenticated session and cross-origin rejection');
}finally{server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));rmSync(folder,{recursive:true});}
