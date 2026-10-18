import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {Store} from '../server/store.ts';
import {backupDatabase} from '../scripts/backup.ts';
import {positive,preliminaryLoad} from '../src/model.ts';

const source=readFileSync('public/legacy/app.js','utf8');
const validate=vm.runInNewContext(source.slice(0,source.indexOf('const modules='))+';validateLegacy');
const valid=()=>({projects:[{id:'P1',name:'Test roof'}],surveys:{},structures:{},designs:{},tasks:[],checks:[]});

test('legacy import rejects malformed records, injected identifiers and photographs',()=>{
 assert.equal(validate(valid()).projects[0].name,'Test roof');
 for(const d of [{...valid(),projects:[null]},{...valid(),tasks:[null]},{...valid(),surveys:{P1:[]}}, {...valid(),projects:[{id:"P');alert(1)//",name:'Injected'}]}, {...valid(),findings:[{photo:'x" onerror="alert(1)'}]},JSON.parse('{"__proto__":{}}')]) assert.throws(()=>validate(d));
 const polluted=JSON.parse(JSON.stringify(valid()));polluted.designs=JSON.parse('{"__proto__":{"name":"bad"}}');assert.throws(()=>validate(polluted));
 const deep=valid() as any;let current=deep;for(let i=0;i<35;i++){current.extra={};current=current.extra}assert.throws(()=>validate(deep),/complex/);
});

test('numbers and derived loads reject coercion, whitespace and overflow',()=>{
 for(const n of [true,false,[],{},' ',null,undefined,Infinity,NaN])assert.throws(()=>positive(n,'Area'));
 assert.equal(positive('94','Area'),94);assert.equal(positive(0,'Other',true),0);
 assert.throws(()=>preliminaryLoad(1e308,1e308,94,0),/range/);
});

test('consistent WAL backup survives restore; migrations preserve data and reject future schemas',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jr-restore-')),path=join(dir,'live.sqlite'),snapshot=join(dir,'backup.sqlite');let s=new Store(path);
 try{
 s.addUser('manager','backup-test-password','manager');const user=s.user(s.login('manager','backup-test-password')!)!;
 const p=s.project(user,{name:'Preserved roof',area:94});s.transaction(()=>s.append(user,p.id,'load',{status:'Preliminary'}));
 backupDatabase(path,snapshot);assert.throws(()=>backupDatabase(path,snapshot),/new file/);
 if(process.platform!=='win32')assert.equal(statSync(snapshot).mode&0o777,0o600);
 const restored=new Store(snapshot);assert.equal(restored.snapshot(user).projects[0].name,'Preserved roof');assert.equal(restored.snapshot(user).records.length,1);assert.equal(restored.db.prepare('SELECT count(*) AS n FROM migrations').get()?.n,1);restored.close();
 s.db.prepare('INSERT INTO migrations VALUES(99,?)').run(new Date().toISOString());s.close();assert.throws(()=>new Store(path),/Unsupported database schema/);
 }finally{try{s.close()}catch{}rmSync(dir,{recursive:true});}
});

test('original V3.6 recovery archive remains byte-for-byte intact',async()=>{
 const {createHash}=await import('node:crypto');
 for(const line of readFileSync('docs/v36-sha256.txt','utf8').trim().split('\n')){
  const [hash,name]=line.split('  ');assert.equal(createHash('sha256').update(readFileSync('docs/original-v36/'+name)).digest('hex'),hash,name);
 }
});
