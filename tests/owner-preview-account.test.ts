import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Store} from '../server/store.ts';

test('owner preview account detection does not modify existing SQLite data',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jr-owner-check-'));
 const path=join(dir,'preview.sqlite');
 try{
  const store=new Store(path);
  const run=()=>spawnSync(process.execPath,['scripts/check-owner-account.ts'],{
   cwd:process.cwd(),env:{...process.env,JR_DB:path},encoding:'utf8'
  });
  assert.equal(run().status,1,'empty database requires owner onboarding');
  const id=store.addUser('test-supervisor','supervisor-pass-123','supervisor');
  assert.ok(id);
  assert.equal(run().status,1,'supervisor is not a manager');
  store.addUser('test-owner','private-manager-password','manager');
  assert.equal(run().status,0,'existing manager is recognised');
  assert.equal((store.db.prepare('SELECT count(*) AS n FROM users').get() as {n:number}).n,2,'read-only check must not alter accounts');
  store.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('owner preview account check does not create a missing database',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jr-owner-missing-'));
 const path=join(dir,'missing.sqlite');
 try{
  const result=spawnSync(process.execPath,['scripts/check-owner-account.ts'],{
   cwd:process.cwd(),env:{...process.env,JR_DB:path},encoding:'utf8'
  });
  assert.equal(result.status,1);
  assert.equal(existsSync(path),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
