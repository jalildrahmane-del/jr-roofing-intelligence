import {verifyIntegrity} from '../server/integrity.ts';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {existsSync,chmodSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';

function verifyEvidence(db:DatabaseSync){
 for(const row of db.prepare('SELECT bytes,sha256 FROM evidence').all() as {bytes:Uint8Array,sha256:string}[]){
  if(createHash('sha256').update(row.bytes).digest('hex')!==row.sha256)throw Error('Backup evidence integrity check failed');
 }
}

// VACUUM INTO creates a consistent SQLite snapshot, including committed WAL data.
export function backupDatabase(source:string,destination:string){
 if(resolve(source)===resolve(destination)||existsSync(destination))throw Error('Backup destination must be a new file');
 if(!existsSync(source))throw Error('Source database does not exist');
 const db=new DatabaseSync(source,{readOnly:true});
 try {
  verifyIntegrity(db);
  verifyEvidence(db);
  db.prepare('VACUUM INTO ?').run(destination);
  chmodSync(destination,0o600);
 } catch(error) {
  // A failed copy must never be mistaken for a valid backup.
  if(existsSync(destination))unlinkSync(destination);
  throw error;
 } finally {db.close();}
 try {
  const check=new DatabaseSync(destination,{readOnly:true});
  try {verifyIntegrity(check);verifyEvidence(check);if(check.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok')throw Error('Backup integrity check failed');}finally{check.close();}
 } catch(error) {
  if(existsSync(destination))unlinkSync(destination);
  throw error;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){
 const destination=process.argv[2];if(!destination)throw Error('Usage: npm run backup -- /private/new-backup.sqlite');
 backupDatabase(process.env.JR_DB||'.data/jr.sqlite',destination);console.log('Backup created and integrity checked');
}
