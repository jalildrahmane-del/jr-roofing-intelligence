import { chromium } from "playwright";
import { Store } from "../server/store.ts";
import { createApp } from "../server/index.ts";
import { workforceCommand } from "../server/workforce.ts";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const s = new Store(":memory:");
const add = (name, role, company) => ({
  id: s.addUser(name, "browser-password", role, company),
  name,
  role,
  company,
});
const manager = add("manager", "manager", "Main"),
  owner = add("owner", "subcontractor-owner", "Alpha"),
  worker = add("worker", "worker", "Alpha"),
  other = add("other", "worker", "Beta");
const pid = s.project(manager, { name: "Fictional owner project" }).id,
  key = randomBytes(32);
const cmd = (u, a, d) => workforceCommand(s, u, pid, a, d, key);
cmd(manager, "config", {
  latitude: 51,
  longitude: 0,
  radiusMetres: 100,
  supervisors: [],
  syntheticOnly: true,
});
for (const w of [worker, other]) {
  cmd(manager, "allocation", {
    workerId: w.id,
    active: true,
    shift: "Day",
    rate: 20,
  });
  cmd(w, "event", {
    event: "in",
    offline: true,
    capturedAt: new Date().toISOString(),
    requestId: w.id,
  });
}
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
  const page = await browser.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByLabel("Username", { exact: true }).fill("manager");
  await page.getByLabel("Password", { exact: true }).fill("browser-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Project Command Centre", exact: true })
    .waitFor();
  await page.goto(base + "/#workforce");
  const schedule = page
    .locator("form")
    .filter({
      has: page.getByRole("heading", { name: "Schedule shift", exact: true }),
    });
  for (const [field, value] of Object.entries({
    workerId: worker.id,
    start: "2026-10-25T08:00:00Z",
    end: "2026-10-25T16:00:00Z",
    breakMinutes: "30",
    reason: "Browser planned shift",
  }))
    await schedule.getByLabel(field, { exact: true }).fill(value);
  await schedule.getByRole("button").click();
  await page.getByText("Browser planned shift", { exact: true }).waitFor();
  const grant = page.locator("form").filter({
    has: page.getByRole("heading", {
      name: "Grant subcontractor owner access",
      exact: true,
    }),
  });
  await grant.getByLabel("ownerId", { exact: true }).fill(owner.id);
  await grant.getByRole("button").click();
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("button")).some(
        (b) => b.textContent === "Saving…",
      ),
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("owner");
  await page.getByLabel("Password", { exact: true }).fill("browser-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Subcontractors & Workforce", exact: true })
    .waitFor();
  await page.getByText(/1 pending/).waitFor();
  assert.equal(await page.locator("nav a").count(), 1);
  assert.equal(
    await page
      .getByRole("button", { name: "Record daily progress", exact: true })
      .count(),
    0,
  );
  assert.ok(!(await page.locator("body").innerText()).includes(other.id));
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download records and report" })
    .click();
  const exported = JSON.parse(
    readFileSync(await (await download).path(), "utf8"),
  );
  assert.equal(exported.scheduleComparison.length, 1);
  assert.equal(exported.scheduleComparison[0].verifiedHours, null);
  assert.equal(exported.schedules.length, 1);
  assert.equal(exported.schedules[0].plannedHours, 7.5);
  assert.equal(exported.report[0].verifiedHours, 0);
  assert.equal(exported.report.length, 1);
  assert.equal(exported.report[0].workerId, worker.id);
  assert.ok(!JSON.stringify(exported).includes(other.id));
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  cmd(manager, "owner", { ownerId: owner.id, active: false });
  await page.reload();
  await page.getByText("Select a project first.", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: company owner login, restricted navigation, company-only export, responsive view and grant revocation",
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  s.close();
}
