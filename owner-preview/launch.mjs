import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync,
  lstatSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { windowsVault } from "./runtime.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  appRoot = join(root, "app"),
  data = join(root, "ReviewData"),
  vaultPath = join(data, "private-logins.dpapi"),
  dbPath = join(data, "jr-review.sqlite"),
  runFile = join(data, "running.json");
process.chdir(appRoot);
const { Store } = await import("../app/server/store.ts"),
  { createApp } = await import("../app/server/index.ts"),
  { seedPreview } = await import("../app/owner-preview/seed.ts"),
  { backupDatabase } = await import("../app/scripts/backup.ts");
function openBrowser(port) {
  if (process.argv.includes("--no-browser")) return;
  spawn("explorer.exe", [`http://127.0.0.1:${port}`], {
    detached: true,
    stdio: "ignore",
  })
    .on("error", () =>
      console.log(`Open http://127.0.0.1:${port} in your browser.`),
    )
    .unref();
}
function showAccounts() {
  const accounts = JSON.parse(
    windowsVault("unprotect", readFileSync(vaultPath)).toString("utf8"),
  );
  console.log(
    "\nPRIVATE FICTIONAL REVIEW ACCOUNTS - keep these on your computer\n",
  );
  for (const a of accounts)
    console.log(
      `Username: ${a.name}\nRole: ${a.role}\nPassword: ${a.password}\n`,
    );
  console.log(
    "These are fictional roles for local software review, not actual professional appointments.",
  );
}
function showOwner() {
  const accounts = JSON.parse(
    windowsVault("unprotect", readFileSync(vaultPath)).toString("utf8"),
  );
  const owner = accounts.find((a) => a.name === "owner");
  if (!owner)
    throw Error(
      "Owner login details are missing. Your saved work is preserved.",
    );
  console.log(
    "\n----------------------------------------\nYOUR LOGIN FOR THIS COPY OF THE APP\n\nUsername: owner\nPassword: " +
      owner.password +
      "\n\nSelect the password with your mouse, then press Ctrl+Shift+C to copy.\nPaste it into the browser password box with Ctrl+V.\nKeep this window open.\n----------------------------------------\n",
  );
}
try {
  console.log("\nJR ROOFING INTELLIGENCE - FREE LOCAL OWNER REVIEW\n");
  if (process.platform !== "win32")
    throw Error(
      "Use this launcher on Windows 10/11 64-bit. The Windows runtime is included.",
    );
  if (existsSync(data) && lstatSync(data).isSymbolicLink())
    throw Error(
      "Move the package into a normal private folder, not a linked data folder.",
    );
  if (!existsSync(data)) {
    console.log(
      "Preparing two fictional projects and your private review accounts. Please wait...",
    );
    const accounts = [
        ["owner", "manager"],
        ["reviewer", "manager"],
        ["engineer", "engineer"],
        ["supervisor", "supervisor"],
        ["viewer", "viewer"],
      ].map(([name, role]) => ({
        name,
        role,
        password: randomBytes(15).toString("base64url"),
      })),
      encrypted = windowsVault(
        "protect",
        Buffer.from(JSON.stringify(accounts)),
      ),
      temporary = join(root, "ReviewData-setup-" + randomUUID());
    mkdirSync(temporary, { mode: 0o700 });
    try {
      seedPreview(
        join(temporary, "jr-review.sqlite"),
        accounts,
        readFileSync(join(root, "owner-preview", "fictional-roof.png")),
      );
      writeFileSync(join(temporary, "private-logins.dpapi"), encrypted, {
        flag: "wx",
        mode: 0o600,
      });
      writeFileSync(
        join(temporary, "README.txt"),
        "Your local fictional review data and encrypted login details. Keep this folder private. Do not delete it if you want to keep your work.\r\n",
      );
      renameSync(temporary, data);
    } catch (e) {
      rmSync(temporary, { recursive: true, force: true });
      throw e;
    }
  }
  if (!existsSync(dbPath) || !existsSync(vaultPath))
    throw Error(
      "ReviewData is incomplete. Your existing files have been preserved. Please ask for help; do not delete your review work.",
    );
  const action = process.argv[2] || "";
  if (action === "--show-accounts") {
    showAccounts();
    process.exit(0);
  }
  if (action === "--backup") {
    const folder = join(data, "Backups");
    mkdirSync(folder, { recursive: true });
    const path = join(
      folder,
      "jr-review-" + new Date().toISOString().replace(/[:.]/g, "-") + ".sqlite",
    );
    backupDatabase(dbPath, path);
    console.log("Backup created and integrity checked:\n" + path);
    process.exit(0);
  }
  if (existsSync(runFile)) {
    try {
      const active = JSON.parse(readFileSync(runFile, "utf8"));
      if (
        Number.isSafeInteger(active.pid) &&
        Number.isInteger(active.port) &&
        active.port > 0 &&
        active.port < 65536
      ) {
        process.kill(active.pid, 0);
        showOwner();
        console.log(
          "The app is already running. Opening its browser tab.\nKeep the original JR Roofing window open.",
        );
        openBrowser(active.port);
        process.exit(0);
      }
    } catch {}
    rmSync(runFile, { force: true });
  }
  const store = new Store(dbPath),
    server = createApp(store, join(appRoot, "dist"));
  const portFile = join(data, "http-port.json");
  let savedPort = 0;
  if (existsSync(portFile)) {
    savedPort = JSON.parse(readFileSync(portFile, "utf8")).port;
    if (!Number.isInteger(savedPort) || savedPort < 1 || savedPort > 65535)
      throw Error(
        "The saved browser address is invalid. Please ask for help; your work is preserved.",
      );
  }
  server.requestTimeout = 30000;
  await new Promise((r, j) => {
    server.once("error", j);
    server.listen(savedPort, "127.0.0.1", r);
  });
  const port = server.address().port;
  try {
    const base = `http://127.0.0.1:${port}`;
    const response = await fetch(base, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error("The app page could not be loaded.");
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(
      (m) => m[1],
    );
    if (assets.length < 2)
      throw Error("The application display files are incomplete.");
    for (const asset of assets) {
      const result = await fetch(base + asset, {
        signal: AbortSignal.timeout(10000),
      });
      if (
        !result.ok ||
        !/javascript|css/.test(result.headers.get("content-type") || "")
      )
        throw Error("The app display file could not be loaded: " + asset);
      await result.arrayBuffer();
    }
  } catch (e) {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    store.close();
    throw e;
  }
  if (!savedPort)
    writeFileSync(portFile, JSON.stringify({ port }), {
      flag: "wx",
      mode: 0o600,
    });
  writeFileSync(runFile, JSON.stringify({ pid: process.pid, port }), {
    mode: 0o600,
  });
  console.log(
    "The REAL app is ready at http://127.0.0.1:" +
      port +
      "\n\nThe login details for THIS app are printed below.\nKeep this window open while reviewing. Close it, or press Ctrl+C, to stop.\n\nYour changes are saved in ReviewData and kept between launches.\nFictional data only. AI, email and paid services are not connected.\nEngineering and QA approvals remain pending until explicit authorised review.\n",
  );
  showOwner();
  openBrowser(port);
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => {
      server.closeAllConnections();
      store.close();
      process.exit(1);
    }, 8000);
    timeout.unref();
    server.close(() => {
      clearTimeout(timeout);
      store.close();
      try {
        const active = JSON.parse(readFileSync(runFile, "utf8"));
        if (active.pid === process.pid) rmSync(runFile, { force: true });
      } catch {}
      process.exit(0);
    });
    server.closeIdleConnections();
  };
  for (const s of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"])
    process.on(s, stop);
} catch (e) {
  console.error(
    "\nCould not start the review app: " +
      e.message +
      "\n\nYour saved work has not been reset. Please share this message for help.",
  );
  process.exitCode = 1;
}
