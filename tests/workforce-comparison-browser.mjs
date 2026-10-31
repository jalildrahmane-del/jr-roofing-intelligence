import { chromium } from "playwright";
import { comparisonFixture } from "./workforce-comparison-fixture.ts";
import { createApp } from "../server/index.ts";
import { mkdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
const f=comparisonFixture();f.plan();f.plan(f.other);const events=f.attendance();f.attendance(f.other);
const server=createApp(f.store);await new Promise(r=>server.listen(0,"127.0.0.1",r));const base=`http://127.0.0.1:${server.address().port}`;let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.JR_CHROMIUM_PATH,args:["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"]});
  const page=await browser.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
  const login=async name=>{await page.goto(base+"/#workforce");await page.getByLabel("Username",{exact:true}).fill(name);await page.getByLabel("Password",{exact:true}).fill("synthetic-password");await page.getByRole("button",{name:"Sign in",exact:true}).click();await page.getByRole("heading",{name:"Subcontractors & Workforce",exact:true}).waitFor();await page.getByRole("heading",{name:"Planned versus verified attendance",exact:true}).waitFor();};
  await login(f.supervisor.name);
  const report=page.getByRole("region",{name:"Planned versus actual workforce report"}),row=report.getByRole("article",{name:"Shift comparison"}).filter({has:page.getByRole("heading",{name:`${f.worker.name} — ${f.worker.company}`,exact:true})});
  await row.getByText("Awaiting supervisor confirmation",{exact:true}).waitFor();
  assert.ok((await row.innerText()).includes("-0.50 hours"));
  const submit=row.getByRole("button",{name:"Record shift match",exact:true});assert.ok(await submit.isDisabled());
  await row.getByLabel("Match evidence and reason",{exact:true}).fill("Synthetic site supervisor checked plan, attendance and breaks.");
  await row.getByRole("checkbox").check();await submit.click();await row.getByText("Confirmed",{exact:true}).waitFor();
  assert.equal(f.state().comparison.totals.confirmedMatches,1);assert.equal(f.state().comparison.totals.verifiedHours,14);
  f.cmd(f.supervisor,"review",{eventId:events.at(-1).id,decision:"accepted",reason:"Synthetic corrected finish evidence",correctedAt:"2026-10-26T15:45:00Z"});
  await page.reload();await row.getByText("Stale — recheck required",{exact:true}).waitFor();assert.equal(f.state().comparison.totals.confirmedMatches,0);
  await row.getByLabel("Match evidence and reason",{exact:true}).fill("Rechecked the corrected attendance revision.");await row.getByRole("checkbox").check();await row.getByRole("button",{name:"Record shift match",exact:true}).click();await row.getByText("Confirmed",{exact:true}).waitFor();
  mkdirSync("artifacts",{recursive:true});
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Comparison fits at "+width);await report.screenshot({path:`artifacts/workforce-comparison-${width}.png`});}
  await page.getByRole("button",{name:"Sign out",exact:true}).click();await login(f.owner.name);
  assert.equal(await report.getByRole("article",{name:"Shift comparison"}).count(),1,"Owner only sees their company's plan");
  assert.equal(await report.getByRole("button",{name:"Record shift match",exact:true}).count(),0);
  assert.ok(!(await report.innerText()).includes(f.other.id));
  const download=page.waitForEvent("download");await report.getByRole("button",{name:"Download planned versus actual CSV",exact:true}).click();const csv=await download;assert.equal(csv.suggestedFilename(),"workforce-planned-versus-actual.csv");const text=readFileSync(await csv.path(),"utf8");assert.ok(text.includes("Confirmed"));assert.ok(text.includes('"-0.25"'));assert.ok(!text.includes(f.other.id));assert.equal(text.split("\r\n").length,3);
  const forbidden=await page.request.post(base+"/api/workforce",{headers:{Origin:base},data:{pid:f.pid,action:"match",data:f.matching(f.state().comparison.rows[0])}});assert.equal(forbidden.status(),403);
  await page.getByRole("button",{name:"Sign out",exact:true}).click();await login(f.worker.name);assert.equal(await report.getByRole("article",{name:"Shift comparison"}).count(),1);assert.equal(await report.getByRole("button",{name:"Record shift match",exact:true}).count(),0);
  assert.deepEqual(errors,[]);console.log("PASS: supervisor match, corrected-evidence invalidation, renewed confirmation, company/worker scope, CSV export and 390/768/1440px");
}finally{await browser?.close();await new Promise(r=>server.close(r));f.store.close();}
