import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs, {readFileSync,writeFileSync,existsSync,mkdtempSync,rmSync,statSync,readdirSync} from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {Store} from '../server/store.ts';
import {backupDatabase} from '../scripts/backup.ts';
import {restoreDatabase} from '../scripts/restore.ts';
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
 const restored=new Store(snapshot);assert.equal(restored.snapshot(user).projects[0].name,'Preserved roof');assert.equal(restored.snapshot(user).records.length,1);assert.equal(restored.db.prepare('SELECT count(*) AS n FROM migrations').get()?.n,3);restored.close();
 s.db.prepare('INSERT INTO migrations VALUES(99,?)').run(new Date().toISOString());s.close();assert.throws(()=>new Store(path),/Unsupported database schema/);
 }finally{try{s.close()}catch{}rmSync(dir,{recursive:true});}
});

test('original V3.6 recovery archive remains byte-for-byte intact',async()=>{
 const {createHash}=await import('node:crypto');
 for(const line of readFileSync('docs/v36-sha256.txt','utf8').trim().split('\n')){
  const [hash,name]=line.split('  ');assert.equal(createHash('sha256').update(readFileSync('docs/original-v36/'+name)).digest('hex'),hash,name);
 }
});

test('backup refuses corrupt SQLite source without leaving a misleading destination',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jr-backup-corrupt-'));
 const source=join(dir,'corrupt.sqlite'),destination=join(dir,'backup.sqlite');
 try {
  writeFileSync(source,'not a sqlite database');
  assert.throws(()=>backupDatabase(source,destination));
  assert.equal(existsSync(destination),false);
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('verified offline restore preserves records but revokes all copied login sessions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jr-safe-restore-'));
 const live=join(dir,'live.sqlite'),backup=join(dir,'backup.sqlite'),restored=join(dir,'restored.sqlite');
 const store=new Store(live);
 try {
  store.addUser('owner','safe-restore-password','manager');
  const token=store.login('owner','safe-restore-password')!;
  const user=store.user(token)!;
  store.project(user,{name:'Recovery acceptance roof',area:42});
  backupDatabase(live,backup);
  restoreDatabase(backup,restored);
  assert.throws(()=>restoreDatabase(backup,restored),/new file/);
  const recovered=new Store(restored);
  try {
   assert.equal(recovered.user(token),null,'session from backup must be revoked');
   const newToken=recovered.login('owner','safe-restore-password');
   assert.ok(newToken,'owner must be able to sign in again');
   assert.equal(recovered.snapshot(recovered.user(newToken!)!).projects[0].name,'Recovery acceptance roof');
  }finally{recovered.close();}
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('verified restore rejects corrupt source without creating destination',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jr-invalid-restore-'));
 const backup=join(dir,'invalid.sqlite'),destination=join(dir,'restored.sqlite');
 try {
  writeFileSync(backup,'invalid backup');
  assert.throws(()=>restoreDatabase(backup,destination));
  assert.equal(existsSync(destination),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('restore rejects tampered evidence bytes even when SQLite tables remain structurally valid',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'jr-evidence-tamper-'));
 const live=join(dir,'live.sqlite'),backup=join(dir,'backup.sqlite'),destination=join(dir,'restored.sqlite');
 const store=new Store(live);
 try {
  store.addUser('owner','evidence-restore-password','manager');
  const user=store.user(store.login('owner','evidence-restore-password')!)!;
  const project=store.project(user,{name:'Evidence test',area:12});
  const bytes=Buffer.from('original photographic evidence');
  const {createHash}=await import('node:crypto');
  store.db.prepare('INSERT INTO evidence(id,pid,mime,bytes,sha256) VALUES(?,?,?,?,?)').run('photo-1',project.id,'image/jpeg',bytes,createHash('sha256').update(bytes).digest('hex'));
  backupDatabase(live,backup);
  const {DatabaseSync}=await import('node:sqlite');
  const altered=new DatabaseSync(backup);
  try {altered.prepare('UPDATE evidence SET bytes=? WHERE id=?').run(Buffer.from('tampered evidence'),'photo-1');}finally{altered.close();}
  assert.throws(()=>restoreDatabase(backup,destination),/evidence integrity/);
  assert.equal(existsSync(destination),false);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test('backup rejects tampered evidence without leaving a destination file',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'jr-backup-evidence-'));
 const live=join(dir,'live.sqlite'),destination=join(dir,'backup.sqlite');
 const store=new Store(live);
 try{
  store.addUser('owner','backup-evidence-password','manager');
  const user=store.user(store.login('owner','backup-evidence-password')!)!;
  const project=store.project(user,{name:'Synthetic evidence backup',area:12});
  const {createHash}=await import('node:crypto');
  const original=Buffer.from('untampered photograph bytes');
  store.db.prepare('INSERT INTO evidence(id,pid,mime,bytes,sha256) VALUES(?,?,?,?,?)').run('synthetic-photo',project.id,'image/jpeg',original,createHash('sha256').update(original).digest('hex'));
  store.db.prepare('UPDATE evidence SET bytes=? WHERE id=?').run(Buffer.from('altered photograph bytes'),'synthetic-photo');
  assert.throws(()=>backupDatabase(live,destination),/evidence integrity/);
  assert.equal(existsSync(destination),false);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

for (const [name, snapshot] of [['backup', backupDatabase], ['restore', restoreDatabase]] as const) {
 test(`${name} preserves a destination another writer creates during publication`, (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'jr-snapshot-race-'));
  const source = join(dir, 'source.sqlite');
  const destination = join(dir, 'destination.sqlite');
  const competingData = Buffer.from('synthetic data created by another operator');
  new Store(source).close();
  const checkExists = fs.existsSync;
  let competed = false;
  const mocked = t.mock.method(fs, 'existsSync', (path: Parameters<typeof fs.existsSync>[0]) => {
   const found = checkExists(path);
   if (path === destination && !found && !competed) {
    writeFileSync(destination, competingData, { flag: 'wx' });
    competed = true;
   }
   return found;
  });
  syncBuiltinESMExports();
  try {
   assert.throws(() => snapshot(source, destination), /destination must be a new file/);
   assert.ok(competed);
   assert.deepEqual(readFileSync(destination), competingData);
   assert.equal(readdirSync(dir).some(entry => entry.startsWith('.jr-snapshot-')), false);
  } finally {
   mocked.mock.restore();
   syncBuiltinESMExports();
   rmSync(dir, { recursive: true, force: true });
  }
 });
}
