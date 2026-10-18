import {DatabaseSync} from 'node:sqlite';
import {existsSync,chmodSync} from 'node:fs';
import {resolve} from 'node:path';

// VACUUM INTO creates a consistent SQLite snapshot, including committed WAL data.
export function backupDatabase(source:string,destination:string){
 if(resolve(source)===resolve(destination)||existsSync(destination))throw Error('Backup destination must be a new file');
 if(!existsSync(source))throw Error('Source database does not exist');
 const db=new DatabaseSync(source,{readOnly:true});
 try {db.prepare('VACUUM INTO ?').run(destination);chmodSync(destination,0o600);}finally{db.close();}
 const check=new DatabaseSync(destination,{readOnly:true});
 try {if(check.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok')throw Error('Backup integrity check failed');}finally{check.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){
 const destination=process.argv[2];if(!destination)throw Error('Usage: npm run backup -- /private/new-backup.sqlite');
 backupDatabase(process.env.JR_DB||'.data/jr.sqlite',destination);console.log('Backup created and integrity checked');
}
