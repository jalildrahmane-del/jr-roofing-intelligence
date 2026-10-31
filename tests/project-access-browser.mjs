import { chromium } from "playwright";
import { Store } from "../server/store.ts";
import { createApp } from "../server/index.ts";
import { documentCommand, documentState } from "../server/documents.ts";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const store=new Store(":memory:");
const add=(name,role)=>({id:store.addUser(name,"synthetic-password",role),name,role,company:"Synthetic"});
const manager=add("team-manager","manager"),staff=add("team-author","supervisor"),reviewer=add("team-reviewer","manager");
const pid=store.project(manager,{name:"Assigned test roof"}).id,privatePid=store.project(manager,{name:"Confidential second project"}).id;
const source=content=>documentCommand(store,manager,pid,"source",{title:content,reference:content,content});
const one=source("Synthetic first source"),two=source("Synthetic second source");
const original=documentCommand(store,manager,pid,"draft",{type:"CPP",title:"Synthetic CPP",sources:[{recordId:one.id,excerpt:"first source"},{recordId:two.id,excerpt:"second source"}],proposals:"Original controls for review",limitations:"Site checks pending"});
documentCommand(store,reviewer,pid,"review",{documentId:original.id,decision:"accepted",attest:true,note:"Synthetic independent original review"});
const server=createApp(store);await new Promise(r=>server.listen(0,"127.0.0.1",r));const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.JR_CHROMIUM_PATH,args:["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"]});
  const ownerContext=await browser.newContext(),staffContext=await browser.newContext();
  const ownerPage=await ownerContext.newPage(),page=await staffContext.newPage(),errors=[];
  for(const p of [ownerPage,page])p.on("pageerror",e=>errors.push(e.message));
  async function login(p,name){await p.goto(base);await p.getByLabel("Username",{exact:true}).fill(name);await p.getByLabel("Password",{exact:true}).fill("synthetic-password");await p.getByRole("button",{name:"Sign in",exact:true}).click();await p.getByRole("heading",{name:"Project Command Centre",exact:true}).waitFor();}
  await login(ownerPage,manager.name);await ownerPage.goto(base+"/#projects");await ownerPage.getByLabel("Active project",{exact:true}).selectOption(pid);
  const access=ownerPage.getByRole("region",{name:"Project access management"});
  await access.getByLabel("Registered team member",{exact:true}).selectOption(staff.id);
  async function permission(value,reason){await access.getByLabel("Project permission",{exact:true}).selectOption(value);await access.getByLabel("Reason for access change",{exact:true}).fill(reason);await access.getByRole("button",{name:"Update project permission",exact:true}).click();await access.getByRole("status").waitFor();}
  await permission("read","Synthetic read-only assignment");
  await login(page,staff.name);await page.goto(base+"/#documents");
  await page.getByText("You have read-only access to this project's documents.",{exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"Revise document",exact:true}).count(),0);
  assert.equal(await page.getByLabel("Active project").locator("option").filter({hasText:"Confidential second project"}).count(),0);
  const post=await page.request.post(base+"/api/document-intelligence",{headers:{Origin:base},data:{pid,action:"source",data:{title:"Denied",reference:"D",content:"Denied"}}});assert.equal(post.status(),403);
  assert.equal((await page.request.get(base+`/api/dossiers/${privatePid}`)).status(),404);
  await permission("edit","Synthetic editing assignment");await page.reload();
  await page.getByRole("button",{name:"Revise document",exact:true}).click();
  const editor=page.getByRole("region",{name:"Document revision editor"});
  assert.equal(await editor.getByRole("group").count(),2,"All original source references remain editable");
  assert.equal(await editor.getByLabel("Revised content",{exact:true}).inputValue(),"Original controls for review");
  await editor.getByLabel("Revised content",{exact:true}).fill("Revised site-specific controls for independent review");
  mkdirSync("artifacts",{recursive:true});
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Revision editor fits "+width);await editor.screenshot({path:`artifacts/document-revision-${width}.png`});}
  await editor.getByRole("button",{name:"Save new document revision",exact:true}).click();
  await page.getByText("Draft — independent review required",{exact:true}).waitFor();
  const documents=documentState(store,manager,pid).documents,newer=documents.at(-1);
  assert.equal(newer.data.version,2);assert.equal(newer.data.sources.length,2);assert.equal(documents[0].status,"Superseded");
  assert.equal(documents[0].data.proposals,"Original controls for review");
  await page.reload();await page.getByText("Draft — independent review required",{exact:true}).waitFor();
  await ownerPage.goto(base+"/#documents");
  const review=ownerPage.locator("form").filter({has:ownerPage.getByRole("heading",{name:"Record independent document review",exact:true})});
  for(const [label,value] of [["documentId",newer.id],["decision","accepted"],["note","Reviewed revised PDF, source references and controls"],["attestation (type reviewed)","reviewed"]])await review.getByLabel(label,{exact:true}).fill(value);
  await review.getByRole("button").click();await ownerPage.getByText("Reviewed for issue — not engineering certification",{exact:true}).waitFor();
  await ownerPage.goto(base+"/#projects");await access.getByLabel("Registered team member",{exact:true}).selectOption(staff.id);await permission("none","Synthetic revocation");
  assert.equal((await page.request.get(base+`/api/document-pdf?pid=${pid}&id=${newer.id}`)).status(),403);
  await page.reload();await page.getByText("Select a project first.",{exact:true}).waitFor();assert.equal(await page.getByText("Synthetic CPP · revision 2",{exact:true}).count(),0);
  assert.equal((await page.request.get(base+`/api/project-access?pid=${pid}`)).status(),403);
  assert.deepEqual(errors,[]);
  console.log("PASS: manager read/edit/revoke UI, scoped staff access, multi-source document revision, fresh independent review, revocation and mobile/tablet/desktop");
}finally{await browser?.close();await new Promise(r=>server.close(r));store.close();}
