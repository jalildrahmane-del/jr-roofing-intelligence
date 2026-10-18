import {spawn} from 'node:child_process';
const port=process.env.JR_API_PORT||'3001';
const children=[spawn(process.execPath,['--watch','server/index.ts'],{stdio:'inherit',env:{...process.env,PORT:port}}),spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',process.env.JR_WEB_PORT||'5173'],{stdio:'inherit',env:{...process.env,JR_API_PORT:port}})];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');process.exitCode=code;}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
for(const child of children){child.on('error',e=>{console.error(e.message);stop(1)});child.on('exit',code=>stop(code||0));}
