import { completeReview } from "./document-review-fixture.ts";
import { chromium } from "playwright";
import { Store } from "../server/store.ts";
import { createApp } from "../server/index.ts";
import { documentCommand } from "../server/documents.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const store = new Store(":memory:");
const author = { id: store.addUser("safety-author", "synthetic-password", "manager"), role: "manager", name: "safety-author", company: "Synthetic" };
const reviewer = { id: store.addUser("safety-reviewer", "synthetic-password", "manager"), role: "manager", name: "safety-reviewer", company: "Synthetic" };
const pid = store.project(author, { name: "Synthetic risk review" }).id;
const source = documentCommand(store, author, pid, "source", { title: "Synthetic source", reference: "S-1", content: "Verify the site-specific work sequence and access controls." });
const server = createApp(store);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.JR_CHROMIUM_PATH, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const login = async name => {
    await page.goto(base);
    await page.getByLabel("Username", { exact: true }).fill(name);
    await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("heading", { name: "Project Command Centre", exact: true }).waitFor();
    await page.goto(base + "/#documents");
    await page.getByRole("heading", { name: "Structured RAMS / CPP authoring" }).waitFor();
  };
  await login(author.name);
  const composer = page.locator(".safety-composer");
  const matrix = composer.getByRole("table", { name: "5 × 5 risk matrix" });
  assert.equal(await matrix.getByRole("cell").count(), 25);
  assert.equal(await matrix.locator(".risk-band-high").count(), 6);
  await composer.getByLabel("Document title", { exact: true }).fill("Synthetic roof RAMS");
  await composer.getByLabel("Current source record").selectOption(source.id);
  await composer.getByLabel("Exact excerpt from selected source").fill("site-specific work sequence");
  await composer.getByLabel("Project / work scope").fill("Synthetic roof access review");
  await composer.getByLabel("Work sequence / safe method").fill("Inspect access controls before any synthetic work activity.");
  const activity = composer.getByRole("group", { name: "Activity 1", exact: true });
  for (const [label, value] of [["Task / activity", "Access roof"], ["Hazard and potential harm", "Fall from height"], ["Persons exposed", "Synthetic roofers"], ["Responsible person", "Synthetic supervisor"], ["Controls / safe system of work", "Verify edge protection and authorised access."]])
    await activity.getByLabel(label, { exact: true }).fill(value);
  for (const [label, value] of [["Initial likelihood", "4"], ["Initial severity", "5"], ["Residual likelihood", "2"], ["Residual severity", "5"]])
    await activity.getByLabel(label).selectOption(value);
  assert.equal(await activity.locator(".risk-score .risk-band-high").innerText(), "20 · High");
  assert.equal(await activity.locator(".risk-score .risk-band-medium").innerText(), "10 · Medium");
  await composer.getByLabel("Outstanding information, exclusions, assumptions and evidence gaps").fill("Synthetic data; competent site review outstanding.");
  await composer.getByText("Read formatted draft before saving", { exact: true }).click();
  assert.match(await composer.locator("pre").innerText(), /Initial risk: L4 x S5 = 20 \(High\)/);
  // A draft that each individual field allows must still respect the combined server limit.
  await composer.getByRole("button", { name: "+ Add activity / hazard" }).click();
  for (const group of [activity, composer.getByRole("group", { name: "Activity 2", exact: true })])
    for (const label of ["Task / activity", "Hazard and potential harm", "Persons exposed", "Responsible person", "Controls / safe system of work"])
      await group.getByLabel(label, { exact: true }).fill("x".repeat(2000));
  await composer.getByLabel("Work sequence / safe method").fill("y".repeat(12000));
  await composer.getByRole("alert").filter({ hasText: "Draft exceeds 30,000 characters" }).waitFor();
  assert.ok(await composer.getByRole("button", { name: "Save source-linked draft for independent review" }).isDisabled());
  assert.equal(await activity.getByLabel("Controls / safe system of work", { exact: true }).inputValue(), "x".repeat(2000));
  await composer.getByRole("group", { name: "Activity 2", exact: true }).getByRole("button", { name: "Remove activity" }).click();
  for (const [label, value] of [["Task / activity", "Access roof"], ["Hazard and potential harm", "Fall from height"], ["Persons exposed", "Synthetic roofers"], ["Responsible person", "Synthetic supervisor"], ["Controls / safe system of work", "Verify edge protection and authorised access."]])
    await activity.getByLabel(label, { exact: true }).fill(value);
  await composer.getByLabel("Work sequence / safe method").fill("Inspect access controls before any synthetic work activity.");
  mkdirSync("artifacts", { recursive: true });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Structured authoring fits at " + width);
    await composer.screenshot({ path: `artifacts/safety-authoring-${width}.png` });
  }
  await composer.getByRole("button", { name: "Save source-linked draft for independent review" }).click();
  await composer.getByRole("status").waitFor();
  const draft = store.snapshot(author).records.find(r => r.kind === "intelligence.draft");
  assert.ok(draft);
  assert.match(draft.data.proposals, /Verify edge protection/);
  const response = await page.request.get(`${base}/api/document-pdf?pid=${pid}&id=${draft.id}`);
  assert.ok(response.ok());
  writeFileSync("artifacts/safety-review.pdf", await response.body());
  const pdfText = execFileSync("pdftotext", ["artifacts/safety-review.pdf", "-"], { encoding: "utf8" });
  for (const text of ["Synthetic roof RAMS", "20 (High)", "10 (Medium)", "Verify edge protection", "site-specific work sequence"])
    assert.ok(pdfText.includes(text), "PDF retains: " + text);
  assert.throws(() => documentCommand(store, author, pid, "review", { documentId: draft.id, decision: "accepted", note: "Attempt self review", attest: true }), /author cannot review own document/i);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(reviewer.name);
  const review = page.locator("form").filter({ has: page.getByRole("heading", { name: "Record independent document review", exact: true }) });
  await completeReview(review,draft.id,"Reviewed synthetic risk ratings, controls, sources and PDF");
  await review.getByRole("button").click();
  await page.getByText("Reviewed for issue — not engineering certification", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("Reviewed for issue — not engineering certification", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS: coloured matrix, live ratings, draft preview, oversized draft preservation, PDF evidence, self-review denial and independent review at mobile/tablet/desktop");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  store.close();
}
