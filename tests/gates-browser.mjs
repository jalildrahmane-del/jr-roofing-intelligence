import { createRequire } from "node:module";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { gateFixture, future } from "./gates-fixture.ts";
import { createApp } from "../server/index.ts";
import { current } from "../src/tender.ts";
import { closeoutBlockers, engineeringApproval } from "../src/gates.ts";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright"),
  folder = mkdtempSync(join(tmpdir(), "jr-gates-browser-")),
  f = gateFixture(join(folder, "db.sqlite")),
  server = createApp(f.store, resolve("dist"));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.JR_CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-gpu", "--no-zygote", "--single-process"],
  });
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  mkdirSync("artifacts", { recursive: true });
  const login = async (name) => {
    await page.goto(base);
    await page.getByLabel("Username", { exact: true }).fill(name);
    await page
      .getByLabel("Password", { exact: true })
      .fill("synthetic-test-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .locator("header")
      .getByText(name + " · " + f.users[name].role)
      .waitFor();
  };
  const logout = async () => {
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
  };
  const route = async (name) => {
    await page.goto(base + "/#" + name);
    await page.locator("main h1").waitFor();
  };
  const section = (title) =>
    page.getByRole("heading", { name: title, exact: true }).locator("..");
  const submit = async (form, name) => {
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/records") && r.request().method() === "POST",
    );
    await form.getByRole("button", { name, exact: true }).click();
    const r = await response;
    assert.equal(r.status(), 201, await r.text());
    await page
      .getByText("Record saved. Approval status updated.", {
        exact: true,
      })
      .waitFor();
  };
  await login("author");
  await route("design");
  await page
    .getByText("Pending — no current authorised engineering acceptance.", {
      exact: true,
    })
    .waitFor();
  assert.equal(engineeringApproval(f.records()), undefined);
  const mandate = section("Engineer authorisation");
  await mandate
    .getByText("Add engineer authorisation", { exact: true })
    .click();
  await mandate
    .getByLabel("Engineer account ID", { exact: true })
    .fill(f.users.engineer.id);
  await mandate
    .getByLabel("Authorised project scope", { exact: true })
    .fill("Synthetic roof project only");
  await mandate
    .getByLabel("Verified qualification and appointment reference", {
      exact: true,
    })
    .fill("SYNTHETIC appointment checked externally");
  await mandate
    .getByLabel("Authorisation valid until", { exact: true })
    .fill(future());
  await mandate
    .getByLabel("Authorisation state", { exact: true })
    .selectOption("active");
  await mandate.locator("input[type=checkbox]").check();
  await submit(mandate, "Save mandate");
  await logout();
  await login("engineer");
  await route("design");
  const engineering = section("Engineering approval gate");
  await engineering
    .getByLabel("Engineering decision", { exact: true })
    .selectOption("accepted");
  for (const title of ["18mm OSB safety query", "Roof loading clarification"])
    await engineering
      .getByLabel("Response: " + title, { exact: true })
      .fill(
        "SYNTHETIC manual engineer response; controlled sequence and restrictions recorded. Not real engineering permission.",
      );
  await engineering
    .getByLabel("Engineer review rationale", { exact: true })
    .fill("SYNTHETIC human review of every pinned input");
  await engineering
    .getByLabel("Signed engineering evidence reference", { exact: true })
    .fill("SYNTHETIC signed professional evidence");
  await engineering.locator("input[type=checkbox]").check();
  await submit(engineering, "Record engineer decision");
  await page
    .getByText("Authorised engineer review recorded for current package.", {
      exact: true,
    })
    .waitFor();
  assert.ok(engineeringApproval(f.records()));
  // Seed synthetic field evidence through the same tested domain service; make one failed hold point for UI recovery.
  const { points, controls } = f.prepareWork();
  f.inspect(points[0].id, "failed");
  await logout();
  await login("reviewer");
  await route("quality");
  const point = page
    .getByRole("heading", {
      name: "Synthetic prestart inspection · v1",
      exact: true,
    })
    .locator("..");
  await point
    .getByText("Inspect and review Synthetic prestart inspection", {
      exact: true,
    })
    .click();
  await point.getByLabel("Decision", { exact: true }).selectOption("accepted");
  await point
    .getByLabel("Inspection findings", { exact: true })
    .fill("SYNTHETIC reinspection passed the recorded criteria");
  await point
    .getByLabel("Inspection evidence reference", { exact: true })
    .fill("SYNTHETIC inspection report");
  await point
    .getByLabel("Reviewer competence reference", { exact: true })
    .fill("SYNTHETIC competency verified");
  await point.locator("input[type=checkbox]").check();
  await submit(point, "Record inspection decision");
  await route("construction");
  for (const stage of ["prestart", "installation", "final"]) {
    const release = page
      .getByRole("heading", { name: stage + " release", exact: true })
      .locator("..");
    await release
      .getByLabel("Release scope and limitations", { exact: true })
      .fill("SYNTHETIC limited human stage permission");
    await release.locator("input[type=checkbox]").check();
    await submit(release, "Release " + stage + " work");
  }
  await logout();
  await login("author");
  await route("construction");
  const diary = section("Daily site diary");
  await diary.getByText("Add daily site diary", { exact: true }).click();
  for (const [label, value] of Object.entries({
    "Diary title": "Synthetic browser diary",
    "Site date": new Date().toISOString().slice(0, 10),
    "Observed weather": "Dry observed locally",
    "Labour and plant on site": "Synthetic team log",
    "Activities and progress": "Synthetic controlled roof works",
    "Safety events, delays and instructions": "Synthetic observations",
    "Diary evidence reference": "SYNTHETIC controlled site report",
  }))
    await diary.getByLabel(label, { exact: true }).fill(value);
  await submit(diary, "Save diary");
  f.prepareHandover();
  await logout();
  await login("reviewer");
  await route("handover");
  assert.deepEqual(closeoutBlockers(f.records()), []);
  const handover = section("Handover approval gate");
  for (const [label, value] of Object.entries({
    "Handover review findings":
      "SYNTHETIC independent acceptance after dossier review",
    "Client representative": "SYNTHETIC client",
    "Signed client acceptance reference":
      "SYNTHETIC external signed acceptance",
    "Client acceptance date": new Date().toISOString().slice(0, 10),
  }))
    await handover.getByLabel(label, { exact: true }).fill(value);
  await handover.locator("input[type=checkbox]").check();
  await submit(handover, "Record handover acceptance");
  await page
    .getByText("Handover acceptance recorded for this exact dossier.", {
      exact: true,
    })
    .waitFor();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export auditable project dossier" })
    .click();
  const download = await downloadEvent,
    dossier = JSON.parse(readFileSync(await download.path(), "utf8"));
  assert.equal(
    dossier.records.filter((r) => r.kind === "handoverAcceptance").length,
    1,
  );
  assert.ok(dossier.audit.length > dossier.records.length);
  writeFileSync(
    "artifacts/issue-3-dossier.json",
    JSON.stringify(dossier, null, 2),
  );
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ["design", "construction", "quality", "handover"]) {
      await route(name);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        name + " overflow at " + width,
      );
      if (width === 390 || (name === "design" && width === 1440))
        await page.screenshot({
          path: `artifacts/issue-3-${name}-${width}.png`,
          fullPage: true,
        });
    }
  }
  // A changed control removes current acceptance and blocks further release; history remains visible after reload.
  const revised = f.save("control", {
    ...controls[0].data,
    previousId: controls[0].id,
    source: "SYNTHETIC RAMS revision B",
  });
  await route("construction");
  await page.reload();
  await page
    .getByRole("button", { name: "Release prestart work", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Release prestart work", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    current(f.records(), "control").find((r) => r.id === revised.id).data
      .version,
    2,
  );
  await route("handover");
  await page
    .getByText("Pending — current dossier has no final acceptance.", {
      exact: true,
    })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: browser authorisation → qualified engineer responses → independent QA reinspection → three stage releases → diary → client-evidenced handover → audit download; changed evidence reopens gates; desktop/tablet/mobile fit and zero page errors",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
  f.store.close();
  rmSync(folder, { recursive: true });
}
