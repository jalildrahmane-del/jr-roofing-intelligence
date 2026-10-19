import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {Store} from '../server/store.ts';
import {createApp} from '../server/index.ts';
const folder=mkdtempSync(join(tmpdir(),'jr-drone-')),store=new Store(join(folder,'db.sqlite'));
store.addUser('test-owner','local-video-test-password','manager');
const server=createApp(store,resolve('dist'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;let browser;
try {
 browser=await chromium.launch({executablePath:process.env.JR_CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-gpu','--no-zygote','--single-process']});
 const page=await browser.newPage();
 await page.goto(base);await page.getByLabel('Username',{exact:true}).fill('test-owner');await page.getByLabel('Password',{exact:true}).fill('local-video-test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:900});
  await page.waitForFunction(()=>document.querySelector('.dashboard-film video')?.readyState>=2);
  const v=page.getByLabel('Roofing drone flyover');assert.ok(await v.evaluate(v=>v.videoWidth>0&&v.controls&&v.muted));
  await v.evaluate(v=>v.play());const time=await v.evaluate(v=>v.currentTime);await page.waitForFunction(t=>document.querySelector('.dashboard-film video').currentTime>t,time);
  await v.evaluate(v=>v.pause());assert.ok(await v.evaluate(v=>v.paused));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.getByLabel('Roofing drone flyover').waitFor();assert.equal(await page.getByLabel('Roofing drone flyover').evaluate(v=>v.autoplay),false);
 console.log('PASS: dashboard drone loads and plays on desktop/mobile, pause works, reduced motion respected.');
} finally {await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));store.close();rmSync(folder,{recursive:true,force:true});}
