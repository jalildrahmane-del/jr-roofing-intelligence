import {existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

// Read-only check: do not create, migrate, or modify an existing owner database.
const path=process.env.JR_DB||'.data/jr.sqlite';
if(!existsSync(path))process.exit(1);
let db:DatabaseSync|undefined;
try{
 db=new DatabaseSync(path,{readOnly:true});
 const result=db.prepare("SELECT count(*) AS n FROM users WHERE role='manager'").get() as {n:number};
 if(Number(result.n)<1)process.exitCode=1;
}catch(error){
 console.error('Unable to verify existing accounts. Database was not changed:',(error as Error).message);
 process.exitCode=2;
}finally{db?.close();}
