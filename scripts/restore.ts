import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {verifyIntegrity} from '../server/integrity.ts';
import {schemaVersion} from '../server/migrations.ts';
import {publishSnapshot} from './snapshot-destination.ts';

// Recovery is deliberately offline and create-only. Stop the app before switching to a restored file.
export function restoreDatabase(source:string,destination:string){
 if(resolve(source)===resolve(destination)||existsSync(destination))throw Error('Restore destination must be a new file');
 if(!existsSync(source))throw Error('Backup file does not exist');
 publishSnapshot(destination,candidate=>{
  const backup=new DatabaseSync(source,{readOnly:true});
  try {
   verifyIntegrity(backup);
   if(backup.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok')throw Error('Backup SQLite integrity check failed');
   const versions=backup.prepare('SELECT version FROM migrations ORDER BY version').all().map((r:any)=>Number(r.version));
   if(versions.length!==schemaVersion||versions.some((v,i)=>v!==i+1))throw Error('Unsupported backup schema');
   for(const row of backup.prepare('SELECT bytes,sha256 FROM evidence').all() as any[]){
    if(createHash('sha256').update(row.bytes as Uint8Array).digest('hex')!==row.sha256)throw Error('Backup evidence integrity check failed');
   }
   backup.prepare('VACUUM INTO ?').run(candidate);
  } finally{backup.close();}
  const restored=new DatabaseSync(candidate);
  try {
   restored.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');
   try {restored.prepare('DELETE FROM sessions').run();restored.exec('COMMIT');}
   catch(error){restored.exec('ROLLBACK');throw error;}
   verifyIntegrity(restored);
   if(restored.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok')throw Error('Restored SQLite integrity check failed');
  }finally{restored.close();}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){
 const [source,destination]=process.argv.slice(2);
 if(!source||!destination)throw Error('Usage: node scripts/restore.ts /private/verified-backup.sqlite /private/new-restored.sqlite');
 restoreDatabase(source,destination);
 console.log('Restored to a NEW file. Existing sessions revoked. Stop the app and explicitly select the restored JR_DB after verifying recovery.');
}
