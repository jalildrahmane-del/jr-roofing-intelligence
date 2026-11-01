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
    await receiptCard.getByRole("checkbox").check();
    await receiptCard.getByRole("button",{name:"Record delivery receipt",exact:true}).click();
    await receiptCard.getByText("Delivery receipt recorded.",{exact:true}).waitFor();
  };
  await receive("DN-BROWSER-1","1","1");
  await receiptCard.getByText("Part delivered — balance outstanding",{exact:true}).waitFor();
  await page.reload();await receiptCard.getByText("Part delivered — balance outstanding",{exact:true}).waitFor();
  await receive("DN-BROWSER-2","1","0");
  await receiptCard.getByText("Received in full",{exact:true}).waitFor();
  assert.equal(await receiptCard.getByRole("button",{name:"Record delivery receipt",exact:true}).count(),0);
  await page.getByRole("button",{name:"Sign out",exact:true}).click();await login("worker");
  await receiptCard.getByText("Received in full",{exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"Record placed order",exact:true}).count(),0);
  assert.equal(await page.getByRole("button",{name:"Record delivery receipt",exact:true}).count(),0);
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
