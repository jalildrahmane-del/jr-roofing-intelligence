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
import { Store } from "../server/store.ts";
import { createApp } from "../server/index.ts";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright"),
  folder = mkdtempSync(join(tmpdir(), "jr-tender-browser-")),
  store = new Store(join(folder, "db.sqlite"));
store.addUser("survey-author", "synthetic-test-password", "manager");
store.addUser("survey-reviewer", "synthetic-test-password", "manager");
const server = createApp(store, resolve("dist"));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.JR_CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-gpu", "--no-zygote", "--single-process"],
  });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      permissions: ["geolocation"],
      geolocation: { latitude: 51.88, longitude: -0.37, accuracy: 8 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  mkdirSync("artifacts", { recursive: true });
  const date = new Date().toISOString().slice(0, 10),
    future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const login = async (name) => {
    await page
      .getByRole("textbox", { name: "Username", exact: true })
      .fill(name);
    await page
      .getByLabel("Password", { exact: true })
      .fill("synthetic-test-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .locator("header")
      .getByText(name + " · manager")
      .waitFor();
  };
  const section = (name) =>
    page.getByRole("heading", { name, exact: true }).locator("..");
  async function fill(scope, values) {
    for (const [label, value] of Object.entries(values))
      await scope.getByLabel(label, { exact: true }).fill(String(value));
  }
  async function choose(scope, label, value) {
    await scope
      .getByLabel(label, { exact: true })
      .selectOption({ label: value });
  }
  async function saved(kind) {
    await page
      .getByRole("status")
      .getByText("Saved " + kind + " revision.", { exact: false })
      .waitFor();
  }
  async function roof(name, area) {
    const form = section("Add a roof survey");
    await fill(form, {
      "Roof name / asset": name,
      "Measured roof area (m²)": area,
      "Roof pitch (degrees)": 5,
      "Primary structure / unknown": "Steel purlins - not verified",
      Surveyor: "Synthetic browser surveyor",
      "Access method and restrictions":
        "Visual observations from safe access platform",
      "Drainage observations": "Outlet needs closer inspection",
      "Survey observations":
        "Synthetic corrosion and failed repairs for testing only",
      "Access limitations and technical assumptions":
        "Visual inspection only. No core samples or structural capacity verified.",
    });
    await choose(form, "Roof covering", "Standing seam metal");
    await choose(form, "Condition", "Poor");
    await choose(form, "Reported leaks", "Unknown");
    await form
      .getByRole("button", { name: "Save roof survey", exact: true })
      .click();
    await saved("roof");
    await page
      .getByRole("button", { name: new RegExp(name + " · " + area) })
      .waitFor();
  }
  await page.goto(base);
  await login("survey-author");
  await page
    .getByRole("link", { name: "Project Register", exact: true })
    .click();
  await fill(page, {
    "Project name": "Synthetic survey-to-tender UI test",
    Client: "Test client",
    "Site address": "Synthetic facility - not a real inspection",
    "Roof area (m²)": 194,
    Sector: "Commercial",
    "Roof type": "Mixed",
  });
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page
    .locator("li")
    .getByText("Synthetic survey-to-tender UI test")
    .waitFor();
  await page
    .getByRole("link", { name: "Roof Survey Intelligence", exact: true })
    .click();
  await roof("Main warehouse", 100);
  await roof("Annexe", 94);
  await page.getByRole("button", { name: /Main warehouse · 100/ }).click();
  const defect = section("Record a defect");
  await choose(defect, "Defect roof", "Main warehouse");
  await choose(defect, "Defect category", "Corrosion / perforation");
  await choose(defect, "Defect severity", "High");
  await fill(defect, {
    "Defect location / grid": "Ridge A1",
    "Affected quantity": 5,
    "Defect evidence description": "Synthetic defect - not a real observation",
    "Recommended action / investigation":
      "Investigate fragility and confirm design before access",
    "Defect technical assumptions / limits":
      "No structural assessment or access approval",
  });
  await choose(defect, "Affected unit", "m");
  await defect
    .getByRole("button", { name: "Save defect", exact: true })
    .click();
  await saved("defect");
  const upload = section("Upload photographic evidence");
  await upload
    .getByRole("button", { name: "Capture current GPS for these photos" })
    .click();
  await upload.getByText(/GPS: 51.880000/).waitFor();
  await fill(upload, { "Photograph caption": "Synthetic roof evidence" });
  await choose(
    upload,
    "Link photograph to defect",
    "Ridge A1 / Corrosion / perforation",
  );
  await upload
    .getByLabel("Photo files (up to 10)", { exact: true })
    .setInputFiles("tests/fixtures/roof.png");
  await upload
    .getByRole("button", { name: "Save photo evidence", exact: true })
    .click();
  await page.getByRole("button", { name: "Annotate / revise photo" }).waitFor();
  await page.getByRole("button", { name: "Annotate / revise photo" }).click();
  await page
    .getByLabel("Marked area label", { exact: true })
    .fill("Synthetic corrosion mark");
  const surface = page.getByRole("img", { name: "Photo annotation surface" }),
    box = await surface.boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.65, {
    steps: 6,
  });
  await page.mouse.up();
  await page
    .getByRole("button", { name: "Save photo annotation revision" })
    .click();
  await page
    .getByText("1 marked areas · revision 2", { exact: true })
    .waitFor();
  await page.reload();
  await page.getByRole("button", { name: /Main warehouse · 100/ }).click();
  await page
    .getByText("1 marked areas · revision 2", { exact: true })
    .waitFor();
  await page.screenshot({
    path: "artifacts/issue-2-survey-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Materials & Specifications", exact: true })
    .click();
  const material = section("Add material and specification source");
  await fill(material, {
    "Product / material": "Synthetic test roof panel",
    "Manufacturer / generic": "Test manufacturer - not a real product",
    "Manufacturer source URL (HTTPS)": "https://example.invalid/test-datasheet",
    "Source document / reference": "SYNTHETIC-DATASHEET-01",
    "Source revision / edition": "TEST revision A",
    "Source checked date": date,
    "Source review due date": future,
    "Specification, properties and limitations":
      "Synthetic test product. λ properties and technical suitability require verification.",
    "Budget unit rate (£, optional)": "20.00",
    "Rate source / quotation reference":
      "Synthetic test rate - not a commercial quotation",
    "Rate date": date,
  });
  await choose(material, "Material category", "Roof covering");
  await choose(material, "Material unit", "m²");
  await material.getByRole("button", { name: "Save material source" }).click();
  await page
    .getByRole("heading", { name: "Synthetic test roof panel", exact: true })
    .waitFor();
  await page
    .getByLabel("Search materials and source references")
    .fill("DATASHEET-01");
  await page
    .getByRole("heading", { name: "Synthetic test roof panel", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "Estimating & Tenders", exact: true })
    .click();
  const estimate = section("New tender option");
  const optionDetails = (title) => ({
    "Option title": title,
    "Included scope": "Synthetic test scope only",
    Exclusions: "Engineering, strengthening and statutory approvals excluded",
    "Pricing and technical assumptions":
      "All rates are synthetic. Re-measure before live use.",
    "Commercial / payment terms": "Test terms - no commercial offer",
    "Quotation valid until": future,
  });
  await fill(estimate, optionDetails("Option A - synthetic overcladding"));
  await choose(
    estimate,
    "Material source 1",
    "Synthetic test roof panel · revision 1",
  );
  await choose(estimate, "Roof for cost line 1", "Main warehouse");
  await choose(estimate, "Quantity basis 1", "Linked measured roof area");
  await fill(estimate, {
    "Description 1": "Synthetic roof covering",
    "Waste % 1": 10,
  });
  for (const [index, category, description, quantity, rate, unit] of [
    [2, "labour", "Labour", 16, 25, "hour"],
    [3, "plant", "Access plant", 2, 150, "day"],
    [4, "scaffold", "Scaffold", 1, 500, "item"],
    [5, "prelims", "Preliminaries", 1, 100, "item"],
  ]) {
    await estimate
      .getByRole("button", { name: "Add cost line", exact: true })
      .click();
    await choose(estimate, "Cost category " + index, category);
    await choose(estimate, "Unit " + index, unit);
    await fill(estimate, {
      ["Description " + index]: description,
      ["Quantity " + index]: quantity,
      ["Unit rate (£) " + index]: rate,
      ["Rate source " + index]: "Synthetic test rate",
      ["Rate date " + index]: date,
    });
  }
  await fill(estimate, {
    "Contingency %": 10,
    "Sales margin %": 20,
    "VAT %": 20,
  });
  await estimate.getByText("£5,775.00", { exact: true }).waitFor();
  await estimate.getByRole("button", { name: "Save tender option" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "Option A - synthetic overcladding" })
    .getByRole("cell", { name: "£5,775.00", exact: true })
    .waitFor();
  const second = section("New tender option");
  await fill(second, {
    ...optionDetails("Option B - synthetic local repair"),
    "Description 1": "Synthetic local repair",
    "Quantity 1": 100,
    "Unit rate (£) 1": 10,
    "Rate source 1": "Synthetic test rate",
    "Rate date 1": date,
    "VAT %": 20,
  });
  await second.getByRole("button", { name: "Save tender option" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "Option B - synthetic local repair" })
    .getByRole("cell", { name: "£1,200.00", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("row")
    .filter({ hasText: "Option A - synthetic overcladding" })
    .getByRole("cell", { name: "£5,775.00", exact: true })
    .waitFor();
  await page
    .getByRole("row")
    .filter({ hasText: "Option B - synthetic local repair" })
    .waitFor();
  const quote = section("Quotation PDFs");
  await quote
    .getByLabel("Document title", { exact: true })
    .fill("Synthetic quotation for independent review");
  await choose(quote, "Quotation option", "Option A - synthetic overcladding");
  await quote.getByRole("button", { name: "Create quotation draft" }).click();
  const draft = quote.getByRole("link", {
    name: "Download draft PDF",
    exact: true,
  });
  await draft.waitFor();
  const downloadPromise = page.waitForEvent("download");
  await draft.click();
  const downloaded = await downloadPromise;
  const bytes = readFileSync(await downloaded.path());
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  writeFileSync("artifacts/issue-2-browser-draft.pdf", bytes);
  await page.getByRole("button", { name: "Sign out" }).click();
  await login("survey-reviewer");
  await page.getByRole("button", { name: "Review document for issue" }).click();
  const review = section("Manager review");
  await review
    .getByLabel("Review note and checked limitations")
    .fill(
      "Synthetic reviewer checked PDF, quantities, rate sources, scope and limitations",
    );
  await choose(
    review,
    "Reviewed complete PDF and limitations",
    "Yes - I have reviewed the complete PDF and limitations",
  );
  await review
    .getByRole("button", { name: "Approve exact document snapshot" })
    .click();
  await page
    .getByRole("link", { name: "Download approved PDF", exact: true })
    .waitFor();
  const approvedPromise = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download approved PDF", exact: true })
    .click();
  const approved = await approvedPromise;
  writeFileSync(
    "artifacts/issue-2-browser-approved.pdf",
    readFileSync(await approved.path()),
  );
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["survey", "materials", "estimating"]) {
      await page.goto(base + "/#" + route);
      await page.locator("main h1").waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + " overflows at " + width,
      );
      if (width === 390)
        await page.screenshot({
          path: `artifacts/issue-2-${route}-mobile.png`,
          fullPage: true,
        });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/#estimating");
  await page.screenshot({
    path: "artifacts/issue-2-estimating-desktop.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: UI creates project, two roofs, defect, GPS photo, annotation revision, material provenance, sourced category takeoff and two reconciled options; reload persists; draft download and independent approval succeed; desktop/tablet/mobile fit; zero page errors",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
  store.close();
  rmSync(folder, { recursive: true });
}
