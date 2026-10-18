import { existsSync, lstatSync, chownSync, chmodSync } from "node:fs";
import { Store } from "../server/store.ts";
import { createApp } from "../server/index.ts";
import { stagingConfig } from "../server/staging.ts";
const config = stagingConfig();
if (!config) throw Error("Explicit owner-staging configuration required");
const path = process.env.JR_DB!;
if (
  !existsSync("/data") ||
  !lstatSync("/data").isDirectory() ||
  lstatSync("/data").isSymbolicLink() ||
  !existsSync(path) ||
  lstatSync(path).isSymbolicLink()
)
  throw Error("Mounted synthetic database must be provisioned before startup");
// The root-owned Railway mount is handed to the unprivileged Node runtime once.
if (process.getuid?.() === 0) {
  for (const p of ["/data", path, path + "-wal", path + "-shm"])
    if (existsSync(p)) {
      if (
        lstatSync(p).isSymbolicLink() ||
        (p !== "/data" && !lstatSync(p).isFile())
      )
        throw Error("Unsafe volume file");
      chownSync(p, 1000, 1000);
    }
  chmodSync("/data", 0o700);
  process.setgroups!([]);
  process.setgid!(1000);
  process.setuid!(1000);
}
process.umask(0o077);
const store = new Store(path),
  owner = store.db
    .prepare("SELECT id,name,role,company FROM users WHERE name=?")
    .get(Object.values(config.accounts)[0]) as any;
if (
  !owner ||
  !store
    .snapshot(owner)
    .records.some(
      (r) =>
        r.kind === "stagingDataset" && r.data.marker === "synthetic-only-v1",
    ) ||
  store.snapshot(owner).projects.some((p) => !p.name.startsWith("[SYNTHETIC]"))
)
  throw Error("Only the prepared synthetic dataset may start in staging");
const accounts = store.db
  .prepare("SELECT name FROM users")
  .all()
  .map((u) => u.name);
if (
  accounts.some(
    (name) => !Object.values(config.accounts).includes(String(name)),
  )
)
  throw Error("Staging contains an unmapped local account");
const port = Number(process.env.PORT || 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("Invalid port");
const server = createApp(store, undefined, config);
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(port, "0.0.0.0", () =>
  console.log(
    "Owner staging listener started; Access and application authentication required",
  ),
);
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    const forced = setTimeout(() => {
      server.closeAllConnections();
      store.close();
      process.exit(1);
    }, 10000);
    forced.unref();
    server.close(() => {
      clearTimeout(forced);
      store.close();
      process.exit(0);
    });
    server.closeIdleConnections();
  });
