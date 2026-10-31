import {chromium} from 'playwright';
import {Store} from '../server/store.ts';
import {createApp} from '../server/index.ts';
import {documentCommand,documentState} from '../server/documents.ts';
import {completeReview} from './document-review-fixture.ts';
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const s=new Store(':memory:');
const add=(name,role)=>({id:s.addUser(name,'browser-password',role),name,role,company:'Fictional'});
const m=add('manager','manager'),a=add('author','supervisor');
const pid=s.project(m,{name:'Fictional roof'}).id;
s.setProjectAccess(m,pid,{userId:a.id,permission:'edit',reason:'Synthetic document browser author assignment'});
const source=documentCommand(s,a,pid,'source',{title:'Fictional source',reference:'S-1',content:'Fictional source requires review.'});
const server=createApp(s);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.JR_CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const login=async name=>{
    await page.goto(base);await page.getByLabel('Username',{exact:true}).fill(name);await page.getByLabel('Password',{exact:true}).fill('browser-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Project Command Centre',exact:true}).waitFor();await page.goto(base+'/#documents');
  };
  await login('author');
  const form=page.locator('form').filter({has:page.getByRole('heading',{name:'Create source-linked draft',exact:true})});
  for(const [key,value] of Object.entries({type:'CPP',title:'Fictional CPP','source record ID':source.id,'exact source excerpt':'requires review',proposals:'Fictional proposed sequence',limitations:'Site conditions unverified','replaces (record ID or none)':'none'}))await form.getByLabel(key,{exact:true}).fill(value);
  await form.getByRole('button').click();await page.getByText('Draft — independent review required',{exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Record independent document review',exact:true}).count(),0,'Author role does not get a manager review form');
  const doc=s.snapshot(m).records.find(r=>r.kind==='intelligence.draft');
  const download=page.waitForEvent('download');await page.getByRole('link',{name:'Download review PDF'}).click();assert.equal((await download).suggestedFilename(),'jr-document.pdf');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await login('manager');
  const review=page.locator('form').filter({has:page.getByRole('heading',{name:'Record independent document review',exact:true})});
  await review.getByLabel('Document to review',{exact:true}).selectOption(doc.id);
  await review.getByRole('group').waitFor();
  assert.equal(await review.getByRole('checkbox').count(),7,'CPP has six checks and a separate attestation');
  assert.ok(await review.getByRole('button',{name:'Record review decision'}).isDisabled());
  await review.getByLabel('Review note',{exact:true}).fill('Access and emergency evidence need revision.');
  await review.getByLabel('Scope and site applicability checked',{exact:true}).check();
  await review.getByLabel('I reviewed the complete PDF, source evidence and limitations',{exact:true}).check();
  assert.ok(await review.getByRole('button',{name:'Record review decision'}).isDisabled(),'Partial checklist cannot accept');
  const denied=await page.request.post(base+'/api/document-intelligence',{headers:{Origin:base},data:{pid,action:'review',data:{documentId:doc.id,decision:'accepted',attest:true,note:'Attempt to bypass form'}}});
  assert.equal(denied.status(),400);
  await review.getByLabel('Review decision',{exact:true}).selectOption('rejected');
  await review.getByRole('button',{name:'Record review decision'}).click();await page.getByText('Rejected — revise draft',{exact:true}).waitFor();
  await completeReview(review,doc.id,'Reviewed complete fictional PDF, risk controls, sources and limitations');
  mkdirSync('artifacts',{recursive:true});
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await review.screenshot({path:`artifacts/document-checklist-${width}.png`});
  }
  await review.getByRole('button',{name:'Record review decision'}).click();await page.getByText('Reviewed for issue — not engineering certification',{exact:true}).waitFor();
  assert.equal(await review.getByRole('checkbox').count(),0,'Completed review clears the confirmations');
  const reviewed=documentState(s,m,pid).documents[0];assert.equal(reviewed.reviewHistory.length,2);assert.equal(reviewed.reviewHistory[0].data.decision,'rejected');
  await page.getByText('Review history (2)',{exact:true}).click();await page.getByText('Access and emergency evidence need revision.',{exact:true}).waitFor();
  const response=await page.request.get(`${base}/api/document-pdf?pid=${pid}&id=${doc.id}`);assert.ok(response.ok());
  writeFileSync('artifacts/document-checklist-reviewed.pdf',await response.body());
  const text=execFileSync('pdftotext',['artifacts/document-checklist-reviewed.pdf','-'],{encoding:'utf8'});
  for(const expected of ['Independent document review','Reviewer: manager','Checklist version: 1','Scope and site applicability checked','Confirmed:','Reviewed complete fictional PDF'])assert.ok(text.includes(expected),'PDF contains '+expected);
  const boxes=execFileSync('pdftotext',['-bbox','artifacts/document-checklist-reviewed.pdf','-'],{encoding:'utf8'});
  for(const match of boxes.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g)){
    const [x1,y1,x2,y2]=match.slice(1).map(Number);assert.ok(x1>=35&&x2<=560&&y1>=30&&y2<=830,'Review receipt stays within printable bounds');
  }
  await page.reload();await page.getByText('Reviewed for issue — not engineering certification',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: source-linked CPP/PDF, incomplete checklist and API bypass rejection, partial rejection, independent acceptance, review history/PDF receipt and 390/768/1440px');
}finally{await browser?.close();await new Promise(r=>server.close(r));s.close();}
