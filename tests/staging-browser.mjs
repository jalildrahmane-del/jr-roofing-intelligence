import { createRequire } from "node:module";
import { createServer as httpsServer } from "node:https";
import { request } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { Store } from "../server/store.ts";
import { createApp } from "../server/index.ts";
import { stagingVerifier } from "../server/staging.ts";
import { seedStaging } from "../scripts/seed-staging.ts";
import { accessFixture } from "./staging-fixture.ts";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright"),
  folder = mkdtempSync(join(tmpdir(), "jr-https-browser-")),
  db = join(folder, "seed.sqlite");
seedStaging(db, "owner-review", "synthetic-owner-password");
const store = new Store(db),
  f = accessFixture(),
  app = createApp(
    store,
    resolve("dist"),
    f.config,
    stagingVerifier(f.config, async () => ({ keys: [f.jwk] })),
  );
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    join(folder, "test-key.pem"),
    "-out",
    join(folder, "test-cert.pem"),
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
  ],
  { stdio: "ignore" },
);
await new Promise((r) => app.listen(0, "127.0.0.1", r));
let allow = true,
  browser;
const edge = httpsServer(
  {
    key: readFileSync(join(folder, "test-key.pem")),
    cert: readFileSync(join(folder, "test-cert.pem")),
  },
  (req, res) => {
    const headers = {
      ...req.headers,
      host: new URL(f.config.origin).host,
      "x-forwarded-proto": "https",
    };
    if (allow) headers["cf-access-jwt-assertion"] = f.token();
    const upstream = request(
      {
        host: "127.0.0.1",
        port: app.address().port,
        path: req.url,
        method: req.method,
        headers,
      },
      (reply) => {
        res.writeHead(reply.statusCode, reply.headers);
        reply.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  },
);
await new Promise((r) => edge.listen(0, "127.0.0.1", r));
const base = `https://127.0.0.1:${edge.address().port}`;
f.config.origin = base;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.JR_CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-gpu", "--no-zygote", "--single-process"],
  });
  const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  mkdirSync("artifacts", { recursive: true });
  await page.goto(base);
  await page.getByText("PRIVATE OWNER STAGING", { exact: false }).waitFor();
  await page.getByLabel("Username", { exact: true }).fill("owner-review");
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic-owner-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Project Command Centre" }).waitFor();
  const cookie = (await context.cookies()).find(
    (c) => c.name === "__Host-jr_session",
  );
  assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite === "Strict");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "dashboard",
      "survey",
      "materials",
      "estimating",
      "structure",
      "design",
      "construction",
      "quality",
      "handover",
      "documents",
    ]) {
      await page.goto(base + "/#" + route);
      await page.locator("main h1").waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + " overflows at " + width,
      );
    }
    if (width === 390)
      await page.screenshot({
        path: "artifacts/staging-https-mobile.png",
        fullPage: true,
      });
  }
  await page.goto(base + "/#survey");
  const draft = page
    .getByRole("link", { name: "Download draft PDF", exact: true })
    .first();
  await draft.waitFor();
  const event = page.waitForEvent("download");
  await draft.click();
  const download = await event;
  assert.ok(
    readFileSync(await download.path())
      .subarray(0, 5)
      .equals(Buffer.from("%PDF-")),
  );
  await page.goto(base + "/#legacy");
  await page.getByTitle("V3.6 prototype").waitFor();
  await page
    .frameLocator("iframe")
    .getByRole("button", { name: /Launch workspace/ })
    .first()
    .waitFor();
  allow = false;
  assert.equal((await page.request.get(base + "/api/state")).status(), 403);
  assert.equal((await page.request.get(base + "/legacy/")).status(), 403);
  allow = true;
  await page.goto(base + "/#dashboard");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
  assert.equal((await page.request.get(base + "/api/state")).status(), 401);
  assert.equal((await page.request.get(base + "/legacy/")).status(), 401);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: actual application over local HTTPS behind simulated signed Access edge; Secure owner-bound cookie, desktop/tablet/mobile routes, real PDF download, V3.6 and both authentication layers enforced; zero page errors. No live provider or deployment.",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((r) => edge.close(r));
  await new Promise((r) => app.close(r));
  store.close();
  rmSync(folder, { recursive: true });
}
