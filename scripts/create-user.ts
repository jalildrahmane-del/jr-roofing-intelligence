import {Store} from '../server/store.ts';
import type {Role} from '../src/model.ts';
import {readFileSync} from 'node:fs';
// Password is read on stdin, never passed as a process argument or printed.
const [name,role,company]=process.argv.slice(2);if(!name||!role)throw Error('Usage: node scripts/create-user.ts USERNAME ROLE [COMPANY] < password-file');const password=readFileSync(0,'utf8').trim();const s=new Store(process.env.JR_DB||'.data/jr.sqlite');s.addUser(name,password,role as Role,company);s.close();console.log('User created');
