import { chromium } from "playwright";
import { Store } from "../server/store.ts";
import { createApp } from "../server/index.ts";
import { workforceCommand, workforceDirectorSummary, workforceState } from "../server/workforce.ts";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
const s = new Store(":memory:");
const add = (name, role) => ({
  id: s.addUser(name, "browser-password", role),
  name,
  role,
  company: "Fictional",
});
const manager = add("manager", "manager"),
  supervisor = add("supervisor", "supervisor"),
  worker = add("worker", "worker");
const pid = s.project(manager, { name: "Fictional roof" }).id;
const key = randomBytes(32);
workforceCommand(
  s,
  manager,
  pid,
  "config",
  {
    latitude: 51,
    longitude: 0,
    radiusMetres: 100,
    supervisors: [supervisor.id],
    syntheticOnly: true,
  },
  key,
);
workforceCommand(
  s,
  manager,
  pid,
  "allocation",
  { workerId: worker.id, active: true, shift: "Day", rate: 20 },
  key,
);
const server = createApp(s);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.JR_CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-gpu", "--no-zygote", "--single-process"],
  });
  const context = await browser.newContext({
    geolocation: { latitude: 51, longitude: 0, accuracy: 10 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const login = async (name) => {
    await page.goto(base + "/#workforce");
    await page.getByLabel("Username", { exact: true }).fill(name);
    await page.getByLabel("Password", { exact: true }).fill("browser-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("heading", { name: "Subcontractors & Workforce", exact: true })
      .waitFor();
    await page.goto(base + "/#workforce");
  };
  await login("manager");
  const policyResponse = await page.request.get(base + "/");
  assert.equal(policyResponse.headers()["permissions-policy"],"camera=(self), microphone=(), geolocation=(self)");
  assert.equal(await page.evaluate(()=>document.featurePolicy.allowsFeature("camera")),true,"Camera must be permitted by the actual document policy");
  assert.equal(await page.evaluate(()=>document.featurePolicy.allowsFeature("microphone")),false,"Audio remains blocked");
  for (const title of ["Record independent review", "Review daily report", "Review materials request"]) {
    const empty = page.locator("form").filter({has:page.getByRole("heading",{name:title,exact:true})});
    assert.equal(await empty.getByRole("button").isDisabled(),true,"Empty review cannot be submitted");
    await empty.getByText(/Nothing is available for you to review/).waitFor();
  }
  const setup = page.locator("form").filter({ has: page.getByRole("heading", { name: "Site location", exact: true }) });
  assert.equal(await setup.getByRole("button", { name: "Save site location", exact: true }).isDisabled(), true);
  await setup.getByRole("button", { name: "Use my location", exact: true }).click();
  await setup.getByText(/Location found · accuracy ±10 metres/).waitFor();
  await setup.getByRole("button", { name: "Save site location", exact: true }).click();
  await setup.getByText("Site location saved.", { exact: true }).waitFor();
  assert.equal((await page.locator("body").innerText()).includes(worker.id), false);
  await context.setGeolocation({ latitude: 51, longitude: 0, accuracy: 500 });
  await setup.getByRole("button", { name: "Use my location", exact: true }).click();
  await setup.getByText(/accuracy ±500 metres/).waitFor();
  await setup.getByRole("button", { name: "Save site location", exact: true }).click();
  await setup.getByRole("alert").filter({ hasText: "Location accuracy is wider" }).waitFor();
  await context.setGeolocation({ latitude: 51, longitude: 0, accuracy: 10 });
  await page.evaluate(() => {
    window.originalGetPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ code: 1 });
  });
  await setup.getByRole("button", { name: "Use my location", exact: true }).click();
  await setup.getByRole("alert").filter({ hasText: "Location permission is blocked" }).waitFor();
  assert.equal(await setup.getByRole("button", { name: "Save site location", exact: true }).isDisabled(), true);
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = window.originalGetPosition; });
  const form = page
    .locator("form")
    .filter({
      has: page.getByRole("heading", {
        name: "Issue supervisor QR",
        exact: true,
      }),
    });
  await form.getByLabel("Worker", { exact: true }).selectOption(worker.id);
  await form.getByLabel("Event", { exact: true }).selectOption("in");
  await form.getByRole("button").click();
  await page.getByAltText("Single-use supervisor attendance QR").waitFor();
  const token = await page
    .getByLabel("Supervisor token", { exact: true })
    .inputValue();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login("worker");
  await page.evaluate(() => {
    window.cameraStopped = 0;
    window.cameraMode = "success";
    window.BarcodeDetector = class { async detect() {
      if (window.cameraMode === "waiting") return [];
      return [{rawValue:"synthetic-scanned-token"}];
    }};
    navigator.mediaDevices.getUserMedia = async () => {
      if (window.cameraMode === "denied") throw Error("denied");
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 32;
      const stream = canvas.captureStream(5);
      canvas.getContext("2d").fillRect(0,0,32,32);
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => { window.cameraStopped++; stop(); };
      }
      if (window.cameraMode === "pending") return new Promise(resolve => { window.releaseCamera = () => resolve(stream); });
      return stream;
    };
  });
  await page.getByRole("button", {name:"Scan supervisor QR with camera"}).click();
  await page.getByText("Token captured. Confirm the project", {exact:false}).waitFor();
  assert.equal(await page.getByLabel("Supervisor QR token",{exact:true}).inputValue(),"synthetic-scanned-token");
  assert.equal(await page.evaluate(() => window.cameraStopped),1);
  await page.evaluate(() => { window.cameraMode = "waiting"; });
  await page.getByRole("button", {name:"Scan supervisor QR with camera"}).click();
  await page.getByText("Point the camera at",{exact:false}).waitFor();
  await page.getByRole("button", {name:"Cancel camera scan"}).click();
  assert.equal(await page.evaluate(() => window.cameraStopped),2);
  await page.evaluate(() => { window.cameraMode = "pending"; });
  await page.getByRole("button", {name:"Scan supervisor QR with camera"}).click();
  await page.waitForFunction(() => !!window.releaseCamera);
  await page.getByRole("button", {name:"Cancel camera scan"}).click();
  await page.evaluate(() => window.releaseCamera());
  await page.waitForFunction(() => window.cameraStopped === 3);
  await page.evaluate(() => {
    window.cameraMode = "pending";
    window.originalCameraTimer = window.setTimeout;
    window.setTimeout = (fn, ms, ...args) => window.originalCameraTimer(fn, ms === 60000 ? 100 : ms, ...args);
  });
  await page.getByRole("button", {name:"Scan supervisor QR with camera"}).click();
  await page.getByText("Camera scan timed out.",{exact:false}).waitFor();
  await page.evaluate(() => { window.setTimeout = window.originalCameraTimer; window.releaseCamera(); });
  await page.waitForFunction(() => window.cameraStopped === 4);
  await page.evaluate(() => { window.cameraMode = "denied"; });
  await page.getByRole("button", {name:"Scan supervisor QR with camera"}).click();
  await page.getByText("Camera could not start.",{exact:false}).waitFor();

  await page.getByRole("checkbox", { name: /I confirm I am recording attendance/ }).check();
  await page.getByLabel("Supervisor QR token", { exact: true }).fill(token);
  await page
    .getByRole("button", { name: "Submit GPS event for review" })
    .click();
  await page.getByText(/1 pending/).waitFor();
  await page.getByLabel("Event", { exact: true }).selectOption("out");
  await page
    .getByRole("button", { name: "Queue unverified event offline" })
    .click();
  await page.reload();
  await page.getByText("1 unverified events held on this device.").waitFor();
  assert.equal(await page.getByRole("button", { name: "Sync pending offline events" }).isDisabled(), true);
  await page.getByRole("checkbox", { name: /I confirm I am recording attendance/ }).check();
  await page
    .getByRole("button", { name: "Sync pending offline events" })
    .click();
  await page.getByText(/2 pending/).waitFor();
  await page.evaluate(() => {
    const key=Object.keys(localStorage).find(k=>k.startsWith("jr-workforce-queue:"));
    localStorage.setItem(key,"{}");
  });
  await page.reload();
  await page.getByText(/Saved offline queue cannot be read/).waitFor();
  assert.equal(await page.getByRole("button",{name:"Sync pending offline events"}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith("jr-workforce-queue:")))),"{}");

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  // Regression: materials must be project scoped, independently reviewed and
  // visible in the manager-only multi-project operations summary.
  const material = workforceCommand(s, worker, pid, "material-request", {
    description: "Roof insulation boards",
    specification: "Fictional 120mm test board",
    quantity: 12, unit: "packs", neededBy: "2026-11-03",
    deliveryPoint: "Fictional site compound", reason: "Next roofing phase",
  }, key);
  assert.equal(material.kind, "workforce.material-request");
  assert.throws(() => workforceCommand(s, worker, pid, "material-review", {
    requestId: material.id, decision: "approved", reason: "Self approval",
  }, key), /Forbidden/);
  const materialReview = workforceCommand(s, supervisor, pid, "material-review", {
    requestId: material.id, decision: "approved", reason: "Reviewed test request",
  }, key);
  assert.equal(materialReview.data.decision, "approved");
  assert.throws(() => workforceCommand(s, supervisor, pid, "material-review", {
    requestId: material.id, decision: "approved", reason: "Duplicate",
  }, key), /already reviewed/);
  assert.throws(() => workforceCommand(s, worker, pid, "material-request", {
    description: "Roof boards", specification: "Test", quantity: 1, unit: "packs",
    neededBy: "2026-02-30", deliveryPoint: "Site", reason: "Test",
  }, key), /Invalid required date/);
  const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==";
  const reportData = {
    day: "2026-10-30", completed: "Insulation and overlay test",
    delays: "None", nextShift: "Roof felt test",
    photos: [{ image: tinyPng, caption: "Test roof image" }],
  };
  assert.throws(() => workforceCommand(s, worker, pid, "daily-report", {
    ...reportData, day: "2026-02-30",
  }, key), /Invalid work date/);
  for (const patch of [{operatives:0},{operatives:1.5},{operatives:10001},{operatives:"2"},{workAreas:""},{conditions:""}]) {
    const before = s.db.prepare("SELECT COUNT(*) AS n FROM evidence").get().n;
    assert.throws(()=>workforceCommand(s,worker,pid,"daily-report",{...reportData,operatives:2,workAreas:"West roof",conditions:"Dry",...patch},key));
    assert.equal(s.db.prepare("SELECT COUNT(*) AS n FROM evidence").get().n,before);
  }
  const report = workforceCommand(s, worker, pid, "daily-report", reportData, key);
  assert.equal(report.kind, "workforce.daily-report");
  assert.equal(report.data.evidence.length, 1);
  assert.ok(s.db.prepare("SELECT id FROM evidence WHERE id=?").get(report.data.evidence[0].assetId));
  assert.throws(() => workforceCommand(s, worker, pid, "daily-review", {
    reportId: report.id, decision: "accepted", reason: "Self review",
  }, key), /Forbidden/);
  const review = workforceCommand(s, supervisor, pid, "daily-review", {
    reportId: report.id, decision: "accepted", reason: "Reviewed",
  }, key);
  assert.equal(review.data.decision, "accepted");
  assert.throws(() => workforceCommand(s, supervisor, pid, "daily-review", {
    reportId: report.id, decision: "accepted", reason: "Duplicate",
  }, key), /already reviewed/);
  const director = workforceDirectorSummary(s, manager).find(r => r.projectId === pid);
  assert.equal(director.materialRequests, 1);
  assert.equal(director.materialPending, 0);
  assert.equal(director.dailyReports, 1);
  assert.equal(director.dailyPending, 0);
  assert.equal(director.photos, 1);
  assert.throws(() => workforceDirectorSummary(s, worker), /Forbidden/);
  // End-to-end: the same submitted records must appear in the manager's
  // dashboard, with pending counts matching the workforce backend.
  const forbiddenDirector = await page.request.get(base + "/api/workforce-director");
  assert.equal(forbiddenDirector.status(), 403, "Workers must not access the director API");
  const secondPid = s.project(manager, { name: "Fictional second site" }).id;
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login("manager");
  await page.goto(base + "/#dashboard");
  const overview = page.getByRole("heading", { name: "Director workforce overview", exact: true });
  await overview.waitFor();
  const firstSite = page.locator(".owner-workforce-card").filter({ has: page.getByRole("heading", { name: "Fictional roof", exact: true }) });
  const secondSite = page.locator(".owner-workforce-card").filter({ has: page.getByRole("heading", { name: "Fictional second site", exact: true }) });
  await firstSite.waitFor();
  await secondSite.waitFor();
  assert.match(await firstSite.innerText(), /Allocated workers\s*1/);
  assert.match(await firstSite.innerText(), /Attendance events \/ awaiting review\s*2 \/ 2/);
  assert.match(await firstSite.innerText(), /Daily reports \/ awaiting review\s*1 \/ 0/);
  assert.match(await firstSite.innerText(), /Submitted photographs\s*1/);
  assert.match(await firstSite.innerText(), /Materials requests \/ awaiting review\s*1 \/ 0/);
  assert.match(await secondSite.innerText(), /Allocated workers\s*0/);
  const response = await page.request.get(base + "/api/workforce-director");
  assert.equal(response.status(), 200);
  const rows = await response.json();
  assert.equal(rows.find(r => r.projectId === pid).dailyReports, 1);
  assert.equal(rows.find(r => r.projectId === secondPid).materialRequests, 0);
  const directorAction=firstSite.locator('[aria-label="Outstanding project actions"]').getByRole('link').first();
  const actionUrl=new URL(await directorAction.getAttribute('href'),base);
  assert.equal(actionUrl.searchParams.get('site'),pid);
  await directorAction.click();
  await page.getByRole('region',{name:'Site action centre',exact:true}).waitFor();
  const focusSection='workforce-'+actionUrl.searchParams.get('action');
  const focusRecord='workforce-record-'+actionUrl.searchParams.get('record');
  await page.waitForFunction(({section,record})=>[section,record].includes(document.activeElement?.id),{section:focusSection,record:focusRecord});
  await page.goto(base+'/#dashboard');
  await firstSite.getByRole("link", { name: "Open workforce records" }).click();
  await page.getByRole("heading", { name: "Subcontractors & Workforce", exact: true }).waitFor();
  assert.match(await page.locator("body").innerText(), /Fictional roof/);
  const reviewForm = page.locator("form").filter({has: page.getByRole("heading", {name:"Record independent review", exact:true})});
  const eventRecord = workforceState(s, manager, pid).records.find(r => r.kind === "workforce.event" && !r.data.offline);
  await reviewForm.getByLabel("Attendance event", {exact:true}).selectOption(eventRecord.id);
  await reviewForm.getByLabel("Decision", {exact:true}).selectOption("accepted");
  await reviewForm.getByLabel("Reason", {exact:true}).fill("Independent test review of the submitted event.");
  await reviewForm.getByRole("button").click();
  await page.getByText(/1 pending/).first().waitFor();
  assert.ok(workforceState(s, manager, pid).records.some(r => r.kind === "workforce.review" && r.data.eventId === eventRecord.id && r.data.decision === "accepted"));
  await reviewForm.getByText("Review saved. The record and review list have been updated.",{exact:true}).waitFor();
  assert.equal(await reviewForm.getByLabel("Reason",{exact:true}).inputValue(),"");
  const requestData = {workerId:worker.id,description:"Next shift boards",specification:"Synthetic boards",quantity:2,unit:"packs",neededBy:"2026-11-03",deliveryPoint:"Test compound",reason:"Test request"};
  const ownRequest = workforceCommand(s,manager,pid,"material-request",requestData,key);
  const pendingRequest = workforceCommand(s,worker,pid,"material-request",requestData,key);
  const ownReport = workforceCommand(s,manager,pid,"daily-report",{...reportData,workerId:worker.id},key);
  const pendingReport = workforceCommand(s,worker,pid,"daily-report",reportData,key);
  await page.reload();
  const actions=page.getByRole("region",{name:"Site action centre",exact:true});
  await actions.getByLabel("Show actions",{exact:true}).selectOption('review');
  const pendingAction=actions.locator('[data-record-id="'+pendingRequest.id+'"]');
  await pendingAction.getByRole('button',{name:'Open item',exact:true}).click();
  assert.equal(await page.locator('.workforce-review').getByLabel('Materials request',{exact:true}).inputValue(),pendingRequest.id);
  assert.equal(await actions.locator('[data-record-id="'+ownRequest.id+'"]').count(),0,'Own submission must not appear in the eligible review filter');
  await actions.getByLabel("Show actions",{exact:true}).selectOption('all');
  await page.route('**/api/workforce?pid=*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Action refresh interrupted'})}),{times:1});
  await actions.getByRole('button',{name:'Refresh site actions',exact:true}).click();
  await actions.getByRole('alert').filter({hasText:'Could not refresh actions'}).waitFor();
  await pendingAction.waitFor();
  await actions.getByRole('button',{name:'Refresh site actions',exact:true}).click();
  await actions.getByRole('alert').waitFor({state:'detached'});
  const materialsReview = page.locator("form").filter({has:page.getByRole("heading",{name:"Review materials request",exact:true})});
  const dailyReview = page.locator("form").filter({has:page.getByRole("heading",{name:"Review daily report",exact:true})});
  await materialsReview.getByLabel("Materials request",{exact:true}).selectOption(pendingRequest.id);
  assert.equal(await materialsReview.locator(`option[value="${ownRequest.id}"]`).count(),0,"Cannot select own materials request");
  assert.equal(await dailyReview.locator(`option[value="${ownReport.id}"]`).count(),0,"Cannot select own daily report");
  await dailyReview.getByLabel("Daily report",{exact:true}).selectOption(pendingReport.id);
  await dailyReview.getByLabel("Decision",{exact:true}).selectOption("accepted");
  await dailyReview.getByLabel("Reason",{exact:true}).fill("Independent report review.");
  await dailyReview.getByRole("button").click();
  await dailyReview.getByText("Review saved. The record and review list have been updated.",{exact:true}).waitFor();
  assert.equal(await dailyReview.getByRole("button").isDisabled(),true);
  await materialsReview.getByLabel("Decision",{exact:true}).selectOption("approved");
  await materialsReview.getByLabel("Reason",{exact:true}).fill("Evidence checked; notes must survive retry.");
  await page.route("**/api/workforce",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Temporary test interruption"})}),{times:1});
  await materialsReview.getByRole("button").click();
  await materialsReview.getByRole("alert").waitFor();
  assert.equal(await materialsReview.getByLabel("Reason",{exact:true}).inputValue(),"Evidence checked; notes must survive retry.");
  assert.equal(await materialsReview.getByLabel("Materials request",{exact:true}).inputValue(),pendingRequest.id);
  assert.equal(await materialsReview.getByText("Review saved. The record and review list have been updated.",{exact:true}).count(),0);
  await materialsReview.getByRole("button").click();
  await materialsReview.getByText("Review saved. The record and review list have been updated.",{exact:true}).waitFor();
  assert.equal(await materialsReview.getByRole("button").isDisabled(),true);
  assert.equal(await materialsReview.getByLabel("Reason",{exact:true}).inputValue(),"");
  const orderCard = page.getByRole("article",{name:"Materials: Next shift boards",exact:true}).filter({hasText:"Approved — awaiting order"});
  await orderCard.getByLabel("Supplier",{exact:true}).fill("Test supplier");
  await orderCard.getByLabel("Order reference",{exact:true}).fill("PO-BROWSER-1");
  await orderCard.getByLabel("Expected delivery date",{exact:true}).fill("2026-11-03");
  await orderCard.getByLabel("Order evidence reference",{exact:true}).fill("Synthetic order confirmation");
  await orderCard.getByRole("checkbox").check();
  for (const width of [390,768,1440]) {
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Materials order fits at "+width);
  }
  await orderCard.getByRole("button",{name:"Record placed order",exact:true}).click();
  await page.getByText("Order recorded.",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Sign out",exact:true}).click();await login("supervisor");
  const receiptCard = page.getByRole("article",{name:"Materials: Next shift boards",exact:true}).filter({hasText:"PO-BROWSER-1"});
  assert.equal(await receiptCard.getByRole("button",{name:"Record placed order",exact:true}).count(),0);
  const receive = async (reference, accepted, damaged) => {
    await receiptCard.getByLabel("Delivery date",{exact:true}).fill(new Date().toISOString().slice(0,10));
    await receiptCard.getByLabel("Delivery note reference",{exact:true}).fill(reference);
    await receiptCard.getByLabel("Accepted quantity (packs)",{exact:true}).fill(accepted);
    await receiptCard.getByLabel("Damaged or rejected quantity (packs)",{exact:true}).fill(damaged);
    await receiptCard.getByLabel("Receipt and condition notes",{exact:true}).fill("Synthetic receipt; damaged packs need replacement.");
    await receiptCard.getByLabel("Evidence photographs (optional, maximum 4)",{exact:true}).setInputFiles({name:"delivery.png",mimeType:"image/png",buffer:Buffer.from(await page.evaluate(()=>{const c=document.createElement("canvas");c.width=16;c.height=16;c.getContext("2d").fillRect(0,0,16,16);return c.toDataURL("image/png").split(",")[1];}),"base64")});
    await receiptCard.getByLabel("Evidence photo 1 caption",{exact:true}).fill("Delivery evidence "+reference);
    await receiptCard.getByRole("checkbox").check();
    await receiptCard.getByRole("button",{name:"Record delivery receipt",exact:true}).click();
    await receiptCard.getByText("Delivery receipt recorded.",{exact:true}).waitFor();
  };
  await receive("DN-BROWSER-1","1","1");
  await receiptCard.getByText("Part delivered — balance outstanding",{exact:true}).waitFor();
  await page.reload();await receiptCard.getByText("Part delivered — balance outstanding",{exact:true}).waitFor();
  await receive("DN-BROWSER-2","1","0");
  await receiptCard.getByText("Received in full",{exact:true}).waitFor();
  assert.equal(await actions.locator('[data-record-id="'+pendingRequest.id+'"]').count(),0,"Full receipt clears its action");
  await receiptCard.getByText("Order and receipt history",{exact:true}).click();
  for(const ref of ["DN-BROWSER-1","DN-BROWSER-2"]){
    const img=receiptCard.getByRole("img",{name:"Delivery evidence "+ref,exact:true});
    await img.waitFor();await img.scrollIntoViewIfNeeded();await img.evaluate(image=>image.decode());
  }
  assert.equal(await receiptCard.getByRole("button",{name:"Record delivery receipt",exact:true}).count(),0);
  await page.getByRole("button",{name:"Sign out",exact:true}).click();await login("worker");
  await receiptCard.getByText("Received in full",{exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"Record placed order",exact:true}).count(),0);
  assert.equal(await page.getByRole("button",{name:"Record delivery receipt",exact:true}).count(),0);
  const dailyForm=page.getByRole("form",{name:"Daily site report",exact:true});
  await dailyForm.getByLabel("Works completed",{exact:true}).fill("Draft overlay works");
  await dailyForm.getByRole("button",{name:"Save draft on this device",exact:true}).click();
  await dailyForm.getByText("Draft saved on this device, including photographs. Not submitted.",{exact:true}).waitFor();
  await page.reload();
  await dailyForm.getByText("Saved draft restored on this device. Not submitted.",{exact:true}).waitFor();
  assert.equal(await dailyForm.getByLabel("Works completed",{exact:true}).inputValue(),"Draft overlay works");
  await dailyForm.getByLabel("Number of operatives",{exact:true}).fill("3");
  await dailyForm.getByLabel("Work areas",{exact:true}).fill("West roof, bays 1–3");
  await dailyForm.getByLabel("Site conditions (weather and access)",{exact:true}).fill("Dry; access clear");
  await dailyForm.getByLabel("Delays or restrictions (write 'None' if applicable)",{exact:true}).fill("None");
  await dailyForm.getByLabel("Plan for next shift",{exact:true}).fill("Continue overlay");
  await dailyForm.getByLabel("Site photographs (1–4)",{exact:true}).setInputFiles({name:"roof.png",mimeType:"image/png",buffer:Buffer.from(await page.evaluate(()=>{const c=document.createElement("canvas");c.width=16;c.height=16;c.getContext("2d").fillRect(0,0,16,16);return c.toDataURL("image/png").split(",")[1];}),"base64")});
  await dailyForm.getByLabel("Photo 1 caption",{exact:true}).fill("West roof evidence");
  await context.setOffline(true);
  await dailyForm.getByRole("button",{name:"Save draft on this device",exact:true}).click();
  await dailyForm.getByText("Draft saved on this device, including photographs. Not submitted.",{exact:true}).waitFor();
  await context.setOffline(false);
  await page.reload();
  assert.equal(await dailyForm.getByLabel("Photo 1 caption",{exact:true}).inputValue(),"West roof evidence");
  assert.equal(await dailyForm.getByLabel("Number of operatives",{exact:true}).inputValue(),"3");
  for(const width of [390,768,1440]) {
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Daily report fits at "+width);
  }
  // A different account does not restore the worker's draft.
  await page.getByRole("button",{name:"Sign out",exact:true}).click();await login("manager");
  assert.equal(await dailyForm.getByLabel("Works completed",{exact:true}).inputValue(),"");
  await page.getByRole("button",{name:"Sign out",exact:true}).click();await login("worker");
  assert.equal(await dailyForm.getByLabel("Works completed",{exact:true}).inputValue(),"Draft overlay works");
  // Simulated storage failure preserves both editor and previously saved draft.
  await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError');};});
  await dailyForm.getByRole("button",{name:"Save draft on this device",exact:true}).click();
  await dailyForm.getByRole("alert").filter({hasText:"Draft could not be saved"}).waitFor();
  await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
  await page.route("**/api/workforce",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Temporary test interruption"})}),{times:1});
  await dailyForm.getByRole("button",{name:"Submit daily report",exact:true}).click();
  await dailyForm.getByRole("alert").waitFor();
  assert.equal(await dailyForm.getByLabel("Works completed",{exact:true}).inputValue(),"Draft overlay works");
  assert.equal(await dailyForm.getByLabel("Photo 1 caption",{exact:true}).inputValue(),"West roof evidence");
  await page.route("**/api/workforce?pid=*",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Refresh interrupted"})}),{times:1});
  await dailyForm.getByRole("button",{name:"Submit daily report",exact:true}).click();
  await dailyForm.getByText("Daily report and photographs submitted for supervisor review.",{exact:true}).waitFor();
  await dailyForm.getByRole("alert").filter({hasText:"Report submitted successfully"}).waitFor();
  const submitted=workforceState(s,manager,pid).records.filter(r=>r.kind==='workforce.daily-report').at(-1);
  assert.equal(submitted.data.operatives,3);assert.equal(submitted.data.workAreas,"West roof, bays 1–3");assert.equal(submitted.data.conditions,"Dry; access clear");
  await page.reload();
  assert.equal(await dailyForm.getByLabel("Works completed",{exact:true}).inputValue(),"");
  assert.equal(await dailyForm.getByLabel("Photo 1 caption",{exact:true}).count(),0);
  await dailyForm.getByLabel("Works completed",{exact:true}).fill("Discard me");
  await dailyForm.getByRole("button",{name:"Save draft on this device",exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());
  await dailyForm.getByRole("button",{name:"Discard draft",exact:true}).click();
  await dailyForm.getByText("Draft discarded.",{exact:true}).waitFor();
  assert.equal(await dailyForm.getByLabel("Works completed",{exact:true}).inputValue(),"");
  const draftKey='jr-daily-draft:'+JSON.stringify([worker.id,pid]);
  await page.evaluate(key=>localStorage.setItem(key,'{broken'),draftKey);
  await page.reload();
  await dailyForm.getByRole("alert").filter({hasText:"Saved draft could not be read"}).waitFor();
  assert.equal(await dailyForm.getByRole("button",{name:"Save draft on this device",exact:true}).isDisabled(),true);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftKey),'{broken');
  page.once('dialog',dialog=>dialog.accept());
  await dailyForm.getByRole("button",{name:"Discard draft",exact:true}).click();
  await dailyForm.getByText("Draft discarded.",{exact:true}).waitFor();
  assert.equal(await dailyForm.getByLabel("Works completed",{exact:true}).isEnabled(),true);
  const requestForm=page.getByRole("form",{name:"Materials request",exact:true});
  await requestForm.getByLabel("Priority",{exact:true}).selectOption("urgent");
  await requestForm.getByLabel("Description",{exact:true}).fill("Urgent photographed insulation");
  await requestForm.getByLabel("Specification",{exact:true}).fill("Synthetic board specification");
  await requestForm.getByLabel("Quantity",{exact:true}).fill("5");
  await requestForm.getByLabel("Unit",{exact:true}).fill("packs");
  await requestForm.getByLabel("Needed by",{exact:true}).fill("2026-11-03");
  await requestForm.getByLabel("Delivery point",{exact:true}).fill("Site compound");
  await requestForm.getByLabel("Reason for request",{exact:true}).fill("Needed for next shift");
  await requestForm.getByLabel("Evidence photographs (optional, maximum 4)",{exact:true}).setInputFiles({name:"request.png",mimeType:"image/png",buffer:Buffer.from(await page.evaluate(()=>{const c=document.createElement("canvas");c.width=16;c.height=16;c.getContext("2d").fillRect(0,0,16,16);return c.toDataURL("image/png").split(",")[1];}),"base64")});
  await requestForm.getByLabel("Evidence photo 1 caption",{exact:true}).fill("Insulation identification");
  await page.route("**/api/workforce",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Request interrupted"})}),{times:1});
  await requestForm.getByRole("button",{name:"Submit materials request",exact:true}).click();
  await requestForm.getByRole("alert").waitFor();
  assert.equal(await requestForm.getByLabel("Evidence photo 1 caption",{exact:true}).inputValue(),"Insulation identification");
  assert.equal(await requestForm.getByLabel("Priority",{exact:true}).inputValue(),"urgent");
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await requestForm.getByRole("button",{name:"Submit materials request",exact:true}).click();
  await requestForm.getByText("Materials request submitted for independent review.",{exact:true}).waitFor();
  await page.reload();
  const urgentCard=page.getByRole("article",{name:"Materials: Urgent photographed insulation",exact:true});
  await urgentCard.getByText("Priority: urgent",{exact:true}).waitFor();
  await urgentCard.getByRole("img",{name:"Insulation identification",exact:true}).scrollIntoViewIfNeeded();
  await urgentCard.getByRole("img",{name:"Insulation identification",exact:true}).evaluate(image=>image.decode());
  assert.equal(await page.getByRole("region",{name:"Materials orders and receipts",exact:true}).getByRole("article").first().getAttribute("aria-label"),"Materials: Urgent photographed insulation");
  const originalCompleted=submitted.data.completed;
  workforceCommand(s,supervisor,pid,'daily-review',{reportId:submitted.id,decision:'returned',reason:'Clarify the west roof work area'},key);
  await page.reload();
  await actions.getByLabel('Show actions',{exact:true}).selectOption('returned');
  await actions.locator('[data-record-id="'+submitted.id+'"]').getByRole('button',{name:'Open item',exact:true}).click();
  assert.equal(await dailyForm.getByLabel('Revise returned report',{exact:true}).inputValue(),submitted.id);
  assert.equal(await dailyForm.getByLabel('Works completed',{exact:true}).inputValue(),originalCompleted);
  assert.equal(await dailyForm.getByLabel('Work date',{exact:true}).getAttribute('readonly'),'');
  await dailyForm.getByText(/Review notes: Clarify the west roof work area/).waitFor();
  await dailyForm.getByLabel('Works completed',{exact:true}).fill('Corrected overlay report — west roof bays 1–3');
  await dailyForm.getByRole('button',{name:'Save draft on this device',exact:true}).click();
  await page.reload();
  assert.equal(await dailyForm.getByLabel('Revise returned report',{exact:true}).inputValue(),submitted.id);
  assert.equal(await dailyForm.getByLabel('Works completed',{exact:true}).inputValue(),'Corrected overlay report — west roof bays 1–3');
  await dailyForm.getByRole('button',{name:'Submit daily report',exact:true}).waitFor({state:'visible'});
  assert.equal(await dailyForm.getByRole('button',{name:'Submit daily report',exact:true}).isEnabled(),true,'Retained evidence allows resubmission without re-upload');
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.route('**/api/workforce',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Revision interrupted'})}),{times:1});
  await dailyForm.getByRole('button',{name:'Submit daily report',exact:true}).click();
  await dailyForm.getByRole('alert').waitFor();
  assert.equal(await dailyForm.getByLabel('Revise returned report',{exact:true}).inputValue(),submitted.id);
  await dailyForm.getByRole('button',{name:'Submit daily report',exact:true}).click();
  await dailyForm.getByText('Daily report and photographs submitted for supervisor review.',{exact:true}).waitFor();
  const revised=workforceState(s,manager,pid).records.find(r=>r.kind==='workforce.daily-report'&&r.data.replacesReportId===submitted.id);
  assert.ok(revised);assert.deepEqual(revised.data.evidence,submitted.data.evidence);
  assert.equal(workforceState(s,manager,pid).records.find(r=>r.id===submitted.id).data.completed,originalCompleted);
  assert.equal(await actions.locator('[data-record-id="'+submitted.id+'"]').count(),0);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await login('supervisor');
  await dailyReview.getByLabel('Daily report',{exact:true}).selectOption(revised.id);
  await dailyReview.getByLabel('Decision',{exact:true}).selectOption('accepted');
  await dailyReview.getByLabel('Reason',{exact:true}).fill('Corrected report and original photographs checked');
  await dailyReview.getByRole('button').click();
  await dailyReview.getByText('Review saved. The record and review list have been updated.',{exact:true}).waitFor();
  assert.equal(workforceState(s,manager,pid).records.find(r=>r.kind==='workforce.daily-review'&&r.data.reportId===revised.id).data.decision,'accepted');
  assert.deepEqual(errors, [], "Workforce/dashboard integration must not produce browser errors");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: supervisor QR -> worker GPS -> pending review; offline queue survives reload and syncs; mobile/tablet/desktop; zero page errors",
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  s.close();
}
