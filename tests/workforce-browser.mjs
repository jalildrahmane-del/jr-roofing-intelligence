import { chromium } from "playwright";
import { Store } from "../server/store.ts";
import { createApp } from "../server/index.ts";
import { workforceCommand } from "../server/workforce.ts";
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
  assert.deepEqual(errors, []);
  console.log(
    "PASS: supervisor QR -> worker GPS -> pending review; offline queue survives reload and syncs; mobile/tablet/desktop; zero page errors",
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  s.close();
}
