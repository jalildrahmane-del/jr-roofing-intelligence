import { chromium } from "playwright";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { Store } from "../server/store.ts";
import { createApp } from "../server/index.ts";
const dir = mkdtempSync(join(tmpdir(), "jr-doc-ui-")),
  s = new Store(join(dir, "db.sqlite"));
for (const name of ["author", "reviewer"])
  s.addUser(name, "synthetic-browser-password", "manager");
const author = s.user(s.login("author", "synthetic-browser-password")),
  reviewer = s.user(s.login("reviewer", "synthetic-browser-password"));
const project = s.project(author, {
  name: "Synthetic document review",
  client: "Test",
  address: "Test",
  area: 94,
  type: "Commercial",
  roof: "Flat",
});
s.setAccess(author, project.id, reviewer.id, "write");
const server = createApp(s, resolve("dist"));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.JR_CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-gpu", "--no-zygote", "--single-process"],
  });
  const page = await browser.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const login = async (name) => {
    await page.goto(base + "/#documents");
    await page.getByLabel("Username", { exact: true }).fill(name);
    await page
      .getByLabel("Password", { exact: true })
      .fill("synthetic-browser-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("heading", { name: "New controlled document" })
      .waitFor();
  };
  await login("author");
  await page.getByLabel("Document number", { exact: true }).fill("DOC-UI-001");
  await page.getByLabel("Revision", { exact: true }).fill("P01");
  await page
    .getByLabel("Document title", { exact: true })
    .fill("Synthetic RAMS");
  await page
    .getByLabel("Manual document content")
    .fill("Synthetic method for review; do not use for construction.");
  await page
    .getByLabel("Limitations and unverified information")
    .fill("Independent review required.");
  await page.getByRole("button", { name: "Save draft revision" }).click();
  const article = page.locator("article").filter({ hasText: "DOC-UI-001" });
  await article
    .getByLabel("Review or submission note")
    .fill("Ready for reviewer");
  await article.getByRole("checkbox").check();
  await article
    .getByRole("button", { name: "Submit for independent review" })
    .click();
  await article
    .getByText("Awaiting independent review", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Sign out" }).click();
  await login("reviewer");
  await article
    .getByLabel("Review or submission note")
    .fill("Reviewed synthetic content");
  await article.getByLabel("Review evidence reference").fill("SYN-REVIEW-UI");
  await article
    .getByLabel("Decision", { exact: true })
    .selectOption("approved");
  await article.getByRole("checkbox").check();
  await article
    .getByRole("button", { name: "Record independent review" })
    .click();
  await article
    .getByText("Approved for document use", { exact: true })
    .waitFor();
  mkdirSync("artifacts", { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `artifacts/issue-4-documents-${width}.png`,
      fullPage: true,
    });
  }
  const downloadPromise = page.waitForEvent("download");
  await article.getByRole("link", { name: "Download review PDF" }).click();
  const download = await downloadPromise;
  await download.saveAs("artifacts/issue-4-review.pdf");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop/mobile manual drafting, submission, independent approval and review PDF download",
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  s.close();
  rmSync(dir, { recursive: true, force: true });
}
