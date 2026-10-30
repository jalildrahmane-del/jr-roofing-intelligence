import { chromium } from "playwright";
import { Store } from "../server/store.ts";
import { createApp } from "../server/index.ts";
import { workforceCommand, workforceDirectorSummary } from "../server/workforce.ts";
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
    await page.goto(base);
    await page.getByLabel("Username", { exact: true }).fill(name);
    await page.getByLabel("Password", { exact: true }).fill("browser-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("heading", { name: "Project Command Centre", exact: true })
      .waitFor();
    await page.goto(base + "/#workforce");
  };
  await login("manager");
  const form = page
    .locator("form")
    .filter({
      has: page.getByRole("heading", {
        name: "Issue supervisor QR",
        exact: true,
      }),
    });
  await form.getByLabel("workerId", { exact: true }).fill(worker.id);
  await form.getByLabel("event", { exact: true }).fill("in");
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
