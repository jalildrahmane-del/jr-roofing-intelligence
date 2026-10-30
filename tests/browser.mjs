import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import assert from 'node:assert/strict';
import {Store} from '../server/store.ts';import {createApp} from '../server/index.ts';
const require=createRequire(import.meta.url),{chromium}=require(process.env.JR_PLAYWRIGHT_MODULE||'playwright');
const folder=mkdtempSync(join(tmpdir(),'jr-browser-')),s=new Store(join(folder,'db.sqlite'));
s.addUser('test-manager','browser-test-password','manager');
const server=createApp(s,resolve('dist'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.JR_CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-gpu','--no-zygote','--single-process']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));mkdirSync('artifacts',{recursive:true});
 const legacyRoutes=['Dashboard','Projects','Roof Survey','Structural Screening','Design & Specification','Construction','QA & Inspections','Client Handover'];
 const shellRoutes={dashboard:'Project Command Centre',projects:'Project Register',survey:'Roof Survey Intelligence',materials:'Materials & Specifications',estimating:'Estimating & Tenders',structure:'Structural Screening',design:'Design & Engineering',construction:'Construction Management',quality:'Quality & Inspections',handover:'Client Handover',documents:'Document Intelligence',workforce:'Subcontractors & Workforce',legacy:'V3.6 Original Workspace'};
 const legacy=async name=>{await page.locator('#nav').getByRole('button',{name:new RegExp(name)}).click();assert.ok((await page.locator('#content').innerText()).length>50,name)};
 const fits=async label=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' overflows');
 await page.goto(base+'/legacy/');await page.getByRole('button',{name:/Launch workspace/}).first().click();
 for(const title of legacyRoutes)await legacy(title);
 await legacy('Roof Survey');await page.locator('#svby').fill('Recovery test');await page.getByRole('button',{name:'Save survey details'}).click();
 await page.reload();await page.getByRole('button',{name:/Launch workspace/}).first().click();await legacy('Roof Survey');assert.equal(await page.locator('#svby').inputValue(),'Recovery test');
 // Persist data in each remaining workflow, then verify it after reload.
 await legacy('Design & Specification');await page.locator('#ds').fill('Recovery test build-up');await page.getByRole('button',{name:'Save specification',exact:true}).click();
 await legacy('Construction');await page.locator('#taskname').fill('Recovery test activity');await page.getByRole('button',{name:'Add activity',exact:true}).click();
 await legacy('QA & Inspections');await page.locator('#qi').fill('Recovery test inspection');await page.getByRole('button',{name:'Save inspection',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:/Launch workspace/}).first().click();
 await legacy('Design & Specification');assert.equal(await page.locator('#ds').inputValue(),'Recovery test build-up');
 await legacy('Construction');assert.ok((await page.locator('#content').innerText()).includes('Recovery test activity'));
 await legacy('QA & Inspections');assert.ok((await page.locator('#content').innerText()).includes('Recovery test inspection'));
 await legacy('Dashboard');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export project data',exact:true}).click();const download=await downloadPromise;
 const exported=JSON.parse(readFileSync(await download.path(),'utf8'));assert.equal(Object.values(exported.surveys)[0].surveyor,'Recovery test');
 // Import an exported dataset, proving compatibility with the original schema.
 exported.projects[0].name='Imported recovery project';page.once('dialog',d=>d.accept());
 await page.locator('#importFile').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.getByRole('heading',{name:'Imported recovery project',exact:true}).waitFor();
 // Invalid imports must leave the current saved dataset untouched.
 const before=await page.evaluate(()=>localStorage.getItem('roofai_v1'));
 const invalidDialog=page.waitForEvent('dialog');await page.locator('#importFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...exported,projects:[null]}))});const warning=await invalidDialog;assert.match(warning.message(),/Import failed/);await warning.dismiss();assert.equal(await page.evaluate(()=>localStorage.getItem('roofai_v1')),before);
 await legacy('Roof Survey');const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Preview / Print client survey report'}).click();const report=await popupPromise;await report.waitForLoadState();await report.getByRole('heading',{name:'ROOF CONDITION SURVEY'}).waitFor();assert.ok((await report.locator('body').innerText()).includes('Recovery test'));await report.close();
 await page.screenshot({path:'artifacts/legacy-survey.png',fullPage:true});
 for(const width of [390,768]){await page.setViewportSize({width,height:844});for(const name of legacyRoutes){await legacy(name);await fits(`Legacy ${name} at ${width}`)}}
 await page.setViewportSize({width:390,height:844});await legacy('Roof Survey');await page.screenshot({path:'artifacts/legacy-mobile.png',fullPage:true});
 // Corrupt local data stays available for recovery and is never silently replaced.
 const broken='{"projects": [null]}';await page.evaluate(v=>localStorage.setItem('roofai_v1',v),broken);await page.reload();await page.getByRole('button',{name:/Launch workspace/}).first().click();await page.getByRole('alert').getByText(/has not been overwritten/).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('roofai_v1')),broken);
 const originalDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export original saved data'}).click();const original=await originalDownload;assert.equal(readFileSync(await original.path(),'utf8'),broken);await page.screenshot({path:'artifacts/legacy-recovery.png',fullPage:true});
 await page.goto(base);await page.getByRole('textbox',{name:'Username',exact:true}).fill('test-manager');await page.getByLabel('Password',{exact:true}).fill('browser-test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Project Command Centre',exact:true}).waitFor();
 await page.getByRole('heading',{name:'Director workforce overview'}).waitFor();
 await page.getByRole('link',{name:'Project Register',exact:true}).click();
 for(const [label,value] of [['Project name','Luton reference test'],['Client','Test Client'],['Site address','8 Prince Way, Luton'],['Roof area (m²)','94'],['Sector','Commercial'],['Roof type','Flat']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Create project'}).click();await page.locator('li').getByText('Luton reference test').waitFor();
 await page.getByRole('link',{name:'Project Command Centre',exact:true}).click();
 await page.getByText('Attendance events / awaiting review').first().waitFor();
 await page.getByRole('link',{name:'Project Register',exact:true}).click();
 // Project QR opens this exact project after login; scanning alone must never create attendance.
 await page.getByRole('link',{name:'Subcontractors & Workforce',exact:true}).click();
 await page.getByRole('heading',{name:'Printable project sign-in QR'}).waitFor();
 await page.getByRole('heading',{name:'Daily site report with photographs'}).waitFor();
 await page.getByRole('button',{name:'Submit daily report'}).waitFor();
 await page.getByRole('heading',{name:'Review daily report'}).waitFor();
 await page.getByRole('heading',{name:'Materials needed on this job'}).waitFor();
 await page.getByRole('heading',{name:'Submit materials request'}).waitFor();
 await page.getByRole('heading',{name:'Review materials request'}).waitFor();

 const siteQr=page.locator('.site-qr-print');
 await siteQr.getByRole('heading',{name:'Luton reference test'}).waitFor();
 await siteQr.locator('img[alt*="QR code"]').waitFor();
 assert.ok((await siteQr.innerText()).includes('does not bypass login'),'QR notice must state authentication requirement');
 const deepLink=await page.evaluate(() => {
   const selected=document.querySelector('select[aria-label="Active project"]');
   return location.origin+'/?site='+encodeURIComponent(selected.value)+'#workforce';
 });
 await page.goto(deepLink);
 await page.getByRole('heading',{name:'Printable project sign-in QR'}).waitFor();
 assert.ok((await page.locator('.site-qr-print').innerText()).includes('Luton reference test'),'QR deep link must preserve selected project');
 await page.getByRole('link',{name:'Project Register',exact:true}).click();
 // Project Register must expose the saved record, not only a blank new-project form.
 await page.getByRole('heading',{name:'Luton reference test — saved project details'}).waitFor();
 const savedDetails=await page.getByRole('region',{name:'Selected project details'}).innerText();
 for(const value of ['Test Client','8 Prince Way, Luton','94 m²','Commercial','Flat'])
   assert.ok(savedDetails.includes(value),'Missing saved project detail: '+value);
 await page.reload();await page.getByRole('heading',{name:'Luton reference test — saved project details'}).waitFor();
 assert.ok((await page.getByRole('region',{name:'Selected project details'}).innerText()).includes('Test Client'),'Saved project details lost after reload');
 // New survey workspace: saved narrative renders safe bold headings and separate access limits.
 await page.goto(base+'/#survey');
 const surveyForm=page.locator('section').filter({has:page.getByRole('heading',{name:'Add a roof survey'})}).first();
 for(const [label,value] of [
  ['Roof name / asset','Test Roof A'],['Measured roof area (m²)','94'],
  ['Roof pitch (degrees)','5'],['Primary structure / unknown','Steel'],
  ['Surveyor','Test Surveyor'],['Access method and restrictions','MEWP only'],
  ['Drainage observations','Gutters visually checked'],
  ['Survey observations','**Overall Roof Condition: POOR**\\n\\nDamaged fixings observed.'],
  ['Access limitations and technical assumptions','Visual inspection only.']
 ]) await surveyForm.getByLabel(label,{exact:true}).fill(value);
 for(const [label,value] of [['Roof covering','Standing seam metal'],['Condition','Poor'],['Reported leaks','Unknown']])
  await surveyForm.getByLabel(label,{exact:true}).selectOption({label:value});
 await surveyForm.getByRole('button',{name:'Save roof survey'}).click();
 await page.getByRole('heading',{name:'Survey observations and recommendations'}).waitFor();
 assert.equal(await page.locator('.survey-notes strong').filter({hasText:'Overall Roof Condition: POOR'}).count(),1,'Markdown emphasis should render as bold text');
 assert.ok((await page.locator('.survey-limitations').innerText()).includes('Visual inspection only.'),'Survey access limitations missing');
 await page.reload();await page.getByRole('heading',{name:'Survey observations and recommendations'}).waitFor();
 await page.goto(base+'/#structure');for(const [label,value] of [['Thickness (mm)','18'],['Density (kg/m³)','650'],['Area (m²)','94'],['Other permanent load (kN/m²)','0']])await page.getByLabel(label,{exact:true}).fill(value);await page.getByRole('button',{name:'Save record'}).click();await page.getByText(/Preliminary \/ Not approved/).waitFor();await page.reload();await page.getByText(/Preliminary \/ Not approved/).waitFor();
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});for(const [route,title] of Object.entries(shellRoutes)){await page.goto(base+'/#'+route);await page.getByRole('heading',{name:title,exact:true}).waitFor();await fits(`${route} at ${width}`)}}
 await page.goto(base+'/#dashboard');await page.reload();await page.locator('.owner-site-card').getByRole('heading',{name:'Luton reference test',exact:true}).waitFor();
 // Director view must not invent green programme status for an unreported project.
 await page.getByRole('heading',{name:'Project status overview'}).waitFor();
 const siteCard=page.locator('.owner-site-card').filter({hasText:'Luton reference test'});
 assert.ok((await siteCard.innerText()).includes('Status not reported'),'Unknown project status must not be shown as green');
 assert.equal(await siteCard.locator('.owner-site-unknown').count(),0,'Unknown status is a card class, not an inner element');
 assert.ok(await siteCard.evaluate(el=>el.classList.contains('owner-site-unknown')),'Missing status must remain neutral');
 // Owner-preview contract: real five-stage links, preserved drone assets and honest activity labelling.
 assert.equal(await page.locator('.owner-stage').count(),5,'Five owner journey stages');
 for(const route of ['survey','estimating','design','construction','handover']){
   assert.equal(await page.locator('.owner-stage[href="#'+route+'"]').count(),1,'Missing stage '+route);
 }
 assert.equal(await page.locator('.owner-film video source[src="/legacy/roof-drone.mp4"]').count(),1,'Drone footage path');
 assert.equal(await page.locator('.owner-film video[poster="/legacy/roof-poster.jpg"]').count(),1,'Drone poster path');
 assert.match(await page.locator('.owner-disclaimer').innerText(),/not task completion, engineering approval or permission to work/i);
 for(const asset of ['/legacy/roof-drone.mp4','/legacy/roof-poster.jpg']){
   const response=await page.request.get(base+asset);
   assert.equal(response.status(),200,'Owner preview media missing: '+asset);
   assert.ok((await response.body()).length>100,'Owner preview media empty: '+asset);
 }
 await page.screenshot({path:'artifacts/dashboard-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'artifacts/dashboard-desktop.png',fullPage:true});
 // A backend error is shown with retry, rather than disappearing into a login reset.
 await page.route('**/api/me',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary test failure'})}));await page.reload();await page.getByRole('alert').getByText(/Unable to load workspace/).waitFor();await page.unroute('**/api/me');await page.getByRole('button',{name:'Retry connection'}).click();await page.getByRole('heading',{name:'Project Command Centre',exact:true}).waitFor();
 await page.goto(base+'/#does-not-exist');await page.getByRole('heading',{name:'Page not found'}).waitFor();await page.getByRole('link',{name:'Return to dashboard'}).click();await page.getByRole('heading',{name:'Project Command Centre',exact:true}).waitFor();
 await page.getByRole('button',{name:'Sign out'}).click();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: eight legacy routes at mobile/tablet; thirteen shell routes at desktop/tablet/mobile; workflow persistence; import/export/recovery; report preview; load persistence; backend retry; sign-out; zero uncaught page errors');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));s.close();rmSync(folder,{recursive:true});}
