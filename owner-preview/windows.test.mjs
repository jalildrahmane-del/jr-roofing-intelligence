import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, execFileSync } from "node:child_process";
const root = resolve(process.env.JR_PREVIEW_FOLDER),
  { windowsVault } = await import(
    pathToFileURL(join(root, "owner-preview/runtime.mjs"))
  );
test(
  "native Windows double-click command, bundled Node, DPAPI logins, authentication, browser backend and saved data",
  { skip: process.platform !== "win32" },
  async () => {
    const child = spawn(
        "cmd.exe",
        ["/d", "/c", "START JR Roofing.cmd", "--no-browser"],
        { cwd: root, stdio: ["pipe", "pipe", "pipe"] },
      ),
      data = join(root, "ReviewData");
    let captured = "",
      errors = "";
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
      assert.equal(JSON.parse(readFileSync(join(data, "http-port.json"), "utf8")).port, active.port);
      const base = `http://127.0.0.1:${active.port}`,
        encrypted = readFileSync(join(data, "private-logins.dpapi")),
        accounts = JSON.parse(
          windowsVault("unprotect", encrypted).toString("utf8"),
        );
      assert.equal(accounts.length, 5);
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
      rmSync(data, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  },
);
