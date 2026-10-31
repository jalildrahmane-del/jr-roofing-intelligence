import { chromium } from "playwright";
import { Store } from "../server/store.ts";
import { createApp } from "../server/index.ts";
import { workforceCommand } from "../server/workforce.ts";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const store = new Store(":memory:");
const add = (name, role, company = "JR") => ({
  id: store.addUser(name, "integration-password", role, company), name, role, company,
});
const manager = add("integration-manager", "manager");
const owner = add("integration-owner", "subcontractor-owner", "Alpha");
const outsider = add("integration-outsider", "subcontractor-owner", "Beta");
const worker = add("integration-worker", "worker", "Alpha");
const pid = store.project(manager, { name: "Synthetic weather roof", address: "President Way, Luton LU2 9NY" }).id;
const otherPid = store.project(manager, { name: "Private second site", address: "Luton LU1 1AA" }).id;
const key = randomBytes(32);
const cmd = (action, data) => workforceCommand(store, manager, pid, action, data, key);
cmd("config", { latitude: 51, longitude: 0, radiusMetres: 100, supervisors: [], syntheticOnly: true });
cmd("allocation", { workerId: worker.id, active: true, shift: "Day", rate: 20 });
const server = createApp(store);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
const weather = {
  date: "2026-10-31", postcode: "LU29NY", updatedAt: "2026-10-31T08:00:00Z",
  temperatureMinC: 6, temperatureMaxC: 13, rainMm: 4, rainProbabilityPercent: 75,
  windMaxMph: 19, gustMaxMph: 32,
  advisory: ["Check wind gusts and site-specific limits before roof work."],
  hourly: [{ time: "2026-10-31T08:00", temperatureC: 8, rainProbabilityPercent: 60, rainMm: 1, windMph: 12, gustMph: 25 }],
  notice: "Forecast only. Assess site conditions.", source: "Synthetic test fixture",
};
try {
  browser = await chromium.launch({
    headless: true, executablePath: process.env.JR_CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 850 } });
    await context.route("**/api/workforce-weather?*", async route => {
      const target = new URL(route.request().url());
      if (target.searchParams.get("pid") !== pid)
        return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Forbidden" }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(weather) });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    async function login(name) {
      await page.goto(base + "/#workforce");
      await page.getByLabel("Username", { exact: true }).fill(name);
      await page.getByLabel("Password", { exact: true }).fill("integration-password");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.getByRole("heading", { name: "Subcontractors & Workforce", exact: true }).waitFor();
    }
    await login(manager.name);
    await page.getByRole("heading", { name: "Today's site weather forecast" }).waitFor();
    await page.getByText("32.0 mph").first().waitFor();
    await page.getByText("Check wind gusts and site-specific limits before roof work.").waitFor();
    await page.getByText("Hourly site forecast").click();
    await page.getByText("25.0 mph").waitFor();
    const planner = page.locator(".workforce-shifts");
    await planner.getByRole("heading", { name: "Planned workforce shifts" }).waitFor();
    await planner.getByLabel("Worker", { exact: true }).selectOption(worker.id);
    await planner.getByLabel("Start").fill("2026-11-02T08:00");
    await planner.getByLabel("Finish").fill("2026-11-02T16:00");
    await planner.getByLabel("Reason").fill("Synthetic roofing shift");
    await planner.getByRole("button", { name: "Save shift plan" }).click();
    await planner.getByText("7.50 planned hours").waitFor();
    const ownerForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Update owner access" }) });
    await ownerForm.getByLabel("Registered owner").selectOption(owner.id);
    await ownerForm.getByRole("button", { name: "Update owner access" }).click();
    await page.getByText("Owner permission updated.").waitFor();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await login(owner.name);
    await page.getByRole("heading", { name: "My company workforce — read only" }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Project Register" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Save shift plan" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Update owner access" }).count(), 0);
    assert.equal(await page.getByText("7.50 planned hours").count(), 1);
    assert.equal(await page.getByRole("heading", { name: "Today's site weather forecast" }).count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow at " + width);
    const blocked = await page.request.get(base + "/api/workforce?pid=" + otherPid);
    assert.equal(blocked.status(), 403);
    const dossier = await page.request.get(base + "/api/dossiers/" + pid);
    assert.equal(dossier.status(), 403);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await login(outsider.name);
    assert.equal(await page.getByText("No shifts planned for this project.").count(), 0);
    assert.equal(await page.getByRole("button", { name: "Save shift plan" }).count(), 0);
    assert.deepEqual(errors, [], "No runtime page errors at width " + width);
    await context.close();
  }
  console.log("PASS: workforce shift UI, weather panel, owner grants, company isolation and 390/768/1440px browser checks");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  store.close();
}
