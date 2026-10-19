@echo off
setlocal
cd /d "%~dp0"
title JR Roofing - Repair blank page
if not exist "%~dp0runtime\node.exe" (
 echo Move FIX-BLANK-PAGE.cmd into the same folder as START JR Roofing first.
 pause
 exit /b 1
)
"%~dp0runtime\node.exe" -e "const fs=require('node:fs');eval(fs.readFileSync(process.argv[1],'utf8').split(['JR_REPAIR','PAYLOAD_20261019'].join('_'))[1])" "%~f0"
set "jr_repair_result=%errorlevel%"
echo.
pause
exit /b %jr_repair_result%
JR_REPAIR_PAYLOAD_20261019
(() => {
 const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
 const hash = b => crypto.createHash('sha256').update(b).digest('hex');
 const root = process.cwd(), target = path.join(root,'app','server','index.ts');
 try {
  if(!fs.existsSync(target)) throw Error('Put this repair file in the same folder as START JR Roofing, then double-click it again.');
  const run = path.join(root,'ReviewData','running.json');
  if(fs.existsSync(run)) {
   const active = JSON.parse(fs.readFileSync(run,'utf8'));
   if(!Number.isSafeInteger(active.pid) || active.pid<=0) throw Error('The running-app record is invalid. Please ask for help.');
   let alive=true;try {process.kill(active.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;else throw e;}
   if(alive) throw Error('Close the black JR Roofing launcher window first, then double-click this repair file again.');
  }
  const before=fs.readFileSync(target), current=hash(before);
  if(current==='d1be22b124653abea369b2273546a3d7201ed175d01cdf995cc450fcfbf86816') {console.log('This copy is already repaired. Double-click START JR Roofing.');return;}
  if(current!=='af3f6bbb6f7665ff2f9478408ad1c3e8decb7ee821070ffb3bd3b06e52421e65') throw Error('This app version is different. Nothing was changed. Please ask for help.');
  const after=Buffer.from(before.toString('utf8').replace('import { resolve, extname } from "node:path";','import { resolve, extname, sep } from "node:path";').replace('path.startsWith(root + "/")','path.startsWith(root + sep)'));
  if(hash(after)!=='d1be22b124653abea369b2273546a3d7201ed175d01cdf995cc450fcfbf86816') throw Error('Repair validation failed. Nothing was changed.');
  const backup=path.join(root,'owner-preview','server-index-before-windows-repair.ts');
  if(!fs.existsSync(backup))fs.writeFileSync(backup,before,{flag:'wx'});
  const temporary=target+'.repair.tmp';fs.writeFileSync(temporary,after,{flag:'wx'});fs.renameSync(temporary,target);
  const provenance=path.join(root,'SOURCE-VERSION.txt');
  if(fs.existsSync(provenance))fs.appendFileSync(provenance,'\nWindows blank-page repair: native path separator for static files.\nPatched server/index.ts SHA256: d1be22b124653abea369b2273546a3d7201ed175d01cdf995cc450fcfbf86816\n');
  const manifest=path.join(root,'FILE-CHECKSUMS.sha256');
  if(fs.existsSync(manifest)) {
   let lines=fs.readFileSync(manifest,'utf8').split('\n');
   for(const name of ['app/server/index.ts','SOURCE-VERSION.txt']) {
    if(fs.existsSync(path.join(root,name))) lines=lines.map(line=>line.endsWith('  '+name)?hash(fs.readFileSync(path.join(root,name)))+'  '+name:line);
   }
   fs.writeFileSync(manifest,lines.join('\n'));
  }
  console.log('REPAIR COMPLETE. Your projects, database and login details were preserved.\n\nDouble-click START JR Roofing and sign in as usual.');
 } catch(e) {console.error('\n'+e.message+'\n');process.exitCode=1;}
})();
