import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  existsSync,
  rmSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { resolve, join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, execFileSync } from "node:child_process";
const root = resolve(process.env.JR_PREVIEW_FOLDER),
  { windowsVault } = await import(
    pathToFileURL(join(root, "owner-preview/runtime.mjs"))
  );
test(
  "Windows repair fixes the original package, preserves data, is idempotent and rejects an unknown source",
  { skip: process.platform !== "win32" },
  () => {
    const folder = mkdtempSync(join(tmpdir(), "JR repair é "));
    try {
      for (const name of [
        "runtime",
        "app/server",
        "owner-preview",
        "ReviewData",
      ])
        mkdirSync(join(folder, name), { recursive: true });
      copyFileSync(
        join(root, "runtime/node.exe"),
        join(folder, "runtime/node.exe"),
      );
      copyFileSync(
        join(root, "FIX-BLANK-PAGE.cmd"),
        join(folder, "FIX-BLANK-PAGE.cmd"),
      );
      const old = execFileSync("git", [
        "show",
        "db7c05981853fcf8237ef5e714d8e72311499029:server/index.ts",
      ]);
      const target = join(folder, "app/server/index.ts");
      writeFileSync(target, old);
      writeFileSync(
        join(folder, "ReviewData/preserved.txt"),
        "existing owner work",
      );
      const repair = () =>
        execFileSync("cmd.exe", ["/d", "/c", "FIX-BLANK-PAGE.cmd"], {
          cwd: folder,
          input: "\r\n",
          encoding: "utf8",
          timeout: 30000,
        });
      assert.match(repair(), /REPAIR COMPLETE/);
      assert.deepEqual(
        readFileSync(target),
        readFileSync(join(root, "app/server/index.ts")),
      );
      assert.equal(
        readFileSync(join(folder, "ReviewData/preserved.txt"), "utf8"),
        "existing owner work",
      );
      assert.deepEqual(
        readFileSync(
          join(folder, "owner-preview/server-index-before-windows-repair.ts"),
        ),
        old,
      );
      assert.match(repair(), /already repaired/);
      writeFileSync(target, "different application source");
      assert.throws(repair);
      assert.equal(
        readFileSync(target, "utf8"),
        "different application source",
      );
    } finally {
      rmSync(folder, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    }
  },
);
test(
  "native Windows double-click command, bundled Node, DPAPI logins, authentication, browser backend and saved data",
  { skip: process.platform !== "win32" },
  async () => {
    const child = spawn(
        "cmd.exe",
        ["/d", "/c", "OPEN-JR-ROOFING.cmd", "--no-browser"],
        { cwd: dirname(root), stdio: ["pipe", "pipe", "pipe"] },
      ),
      data = join(root, "ReviewData");
    let captured = "",
      errors = "";
    let browser;
    child.stdout.on("data", (b) => (captured += b));
    child.stderr.on("data", (b) => (errors += b));
    try {
      const deadline = Date.now() + 45000;
      while (!existsSync(join(data, "running.json")) && Date.now() < deadline) {
        if (child.exitCode !== null)
          throw Error(
            "Windows launcher exited before startup; no credentials printed",
          );
        await new Promise((r) => setTimeout(r, 200));
      }
      assert.ok(
        existsSync(join(data, "running.json")),
        "Launcher must become ready",
      );
      const active = JSON.parse(
        readFileSync(join(data, "running.json"), "utf8"),
      );
      assert.ok(active.port > 0);
      assert.equal(
        JSON.parse(readFileSync(join(data, "http-port.json"), "utf8")).port,
        active.port,
      );
      const base = `http://127.0.0.1:${active.port}`,
        encrypted = readFileSync(join(data, "private-logins.dpapi")),
        accounts = JSON.parse(
          windowsVault("unprotect", encrypted).toString("utf8"),
        );
      assert.equal(accounts.length, 5);
      await new Promise((r) => setTimeout(r, 200));
      assert.ok(
        captured.includes("Username: owner") &&
          captured.includes(accounts.find((a) => a.name === "owner").password),
        "The single launcher must display the owner login",
      );
      assert.equal(new Set(accounts.map((a) => a.password)).size, 5);
      assert.ok(
        accounts.every(
          (a) =>
            a.password.length >= 20 &&
            !encrypted.includes(Buffer.from(a.password)),
        ),
      );
      assert.throws(() =>
        windowsVault("unprotect", Buffer.from("not a protected credential")),
      );
      const html = await fetch(base).then((r) => r.text());
      for (const asset of [
        ...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g),
      ].map((m) => m[1])) {
        const response = await fetch(base + asset);
        assert.equal(
          response.status,
          200,
          "Windows must serve frontend assets: " + asset,
        );
        assert.match(response.headers.get("content-type"), /javascript|css/);
      }
      const { chromium } = createRequire(import.meta.url)("playwright");
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage(),
        pageErrors = [],
        assetErrors = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      page.on("response", (r) => {
        if (r.url().includes("/assets/") && r.status() !== 200)
          assetErrors.push(r.status());
      });
      await page.goto(base);
      await page.getByLabel("Username", { exact: true }).fill("owner");
      await page
        .getByLabel("Password", { exact: true })
        .fill(accounts.find((a) => a.name === "owner").password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.locator("header").getByText("owner · manager").waitFor();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const route of [
          "dashboard",
          "survey",
          "materials",
          "estimating",
          "design",
          "construction",
          "quality",
        ]) {
          await page.goto(base + "/#" + route);
          await page.locator("main h1").waitFor();
          if (route === "dashboard") {
            const video = page.getByLabel("Roofing drone flyover");
            await video.waitFor({state: "visible"});
            await page.waitForFunction(() => document.querySelector(".dashboard-film video")?.readyState >= 2);
            assert.ok(await video.evaluate(v => v.videoWidth > 0 && v.controls && v.muted));
          }
          assert.ok((await page.locator("main").innerText()).length > 100);
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 2,
            ),
          );
        }
      }
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(assetErrors, []);
      await browser.close();
      browser = undefined;
      assert.equal((await fetch(base + "/api/state")).status, 401);
      const owner = accounts.find((a) => a.name === "owner"),
        r = await fetch(base + "/api/login", {
          method: "POST",
          headers: { Origin: base, "Content-Type": "application/json" },
          body: JSON.stringify({ name: owner.name, password: owner.password }),
        });
      assert.equal(r.status, 200);
      const cookie = r.headers.get("set-cookie").split(";")[0],
        state = await fetch(base + "/api/state", {
          headers: { Cookie: cookie },
        }).then((r) => r.json());
      assert.equal(state.projects.length, 2);
      const doc = state.records.find((r) => r.kind === "document");
      const pdf = await fetch(base + "/api/reports/" + doc.id + ".pdf", {
        headers: { Cookie: cookie },
      });
      assert.equal(pdf.status, 200);
      assert.ok(
        Buffer.from(await pdf.arrayBuffer())
          .subarray(0, 5)
          .equals(Buffer.from("%PDF-")),
      );
      const address = execFileSync(
        join(root, "runtime/node.exe"),
        [join(root, "owner-preview/launch.mjs"), "--no-browser"],
        { cwd: root, encoding: "utf8" },
      );
      assert.match(address, /already running/);
      assert.ok(
        address.includes(owner.password),
        "Reopening the launcher shows the login again",
      );
      execFileSync(
        join(root, "runtime/node.exe"),
        [join(root, "owner-preview/launch.mjs"), "--backup"],
        { cwd: root, stdio: "pipe" },
      );
      assert.ok(existsSync(join(data, "Backups")));
      const { Store } = await import(
          pathToFileURL(join(root, "app/server/store.ts"))
        ),
        s = new Store(join(data, "jr-review.sqlite"));
      assert.equal(
        s.db.prepare("PRAGMA integrity_check").get().integrity_check,
        "ok",
      );
      s.close();
      assert.ok(!errors.includes("Error:"));
    } finally {
      await browser?.close();
      try {
        const active = JSON.parse(
          readFileSync(join(data, "running.json"), "utf8"),
        );
        process.kill(active.pid);
      } catch {}
      try {
        execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
        });
      } catch {}
      captured = "";
      errors = "";
      await new Promise((r) => setTimeout(r, 500));
      rmSync(data, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    }
  },
);
