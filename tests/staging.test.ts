import { request } from "node:http";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  statSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stagingConfig, stagingVerifier } from "../server/staging.ts";
import { renderReport } from "../server/report.ts";
import { saveRecord } from "../server/index.ts";
import { createApp } from "../server/index.ts";
import { Store } from "../server/store.ts";
import { seedStaging } from "../scripts/seed-staging.ts";
import {
  encryptStagingBackup,
  restoreStagingBackup,
  verifyStagingBackup,
} from "../scripts/staging-backup.ts";
import { accessFixture } from "./staging-fixture.ts";

test("staging configuration fails closed without exact HTTPS origin, named emails, volume and synthetic data policy", () => {
  const env = {
    JR_MODE: "owner-staging",
    JR_PUBLIC_ORIGIN: "https://staging.example.invalid",
    JR_ACCESS_TEAM: "https://owner.cloudflareaccess.com",
    JR_ACCESS_AUD: "a".repeat(64),
    JR_ACCESS_ACCOUNTS: JSON.stringify({
      "owner@example.invalid": "owner-review",
    }),
    JR_STAGING_DATA: "synthetic-only",
    JR_DB: "/data/jr-staging.sqlite",
    RAILWAY_VOLUME_MOUNT_PATH: "/data",
  };
  assert.equal(stagingConfig({}), undefined);
  assert.equal(stagingConfig(env)?.origin, env.JR_PUBLIC_ORIGIN);
  for (const [key, value] of Object.entries({
    JR_MODE: "production",
    JR_PUBLIC_ORIGIN: "http://staging.example.invalid",
    JR_ACCESS_TEAM: "https://evil.invalid",
    JR_ACCESS_AUD: "",
    JR_ACCESS_ACCOUNTS: "{}",
    JR_STAGING_DATA: "real",
    JR_DB: ".data/live.sqlite",
    RAILWAY_VOLUME_MOUNT_PATH: "",
    OPENAI_API_KEY: "synthetic-never-live",
  }))
    assert.throws(() => stagingConfig({ ...env, [key]: value }), key);
});
test("Access verifier checks cryptographic signature, issuer, audience, expiry, token type, named email and unavailable keys", async () => {
  const f = accessFixture(),
    verify = stagingVerifier(f.config, async () => ({ keys: [f.jwk] }));
  assert.equal((await verify(f.token())).account, "owner-review");
  for (const changes of [
    { iss: "https://evil.invalid" },
    { aud: ["wrong"] },
    { exp: 0 },
    { iat: 9999999999 },
    { email: "intruder@example.invalid" },
    { type: "org" },
    { nbf: 9999999999 },
    { exp: Math.floor(Date.now() / 1000) + 7200 },
  ])
    await assert.rejects(verify(f.token(changes)));
  await assert.rejects(verify(f.token({}, { alg: "none" })));
  await assert.rejects(verify(f.token().slice(0, -8) + "AAAAAAAA"));
  await assert.rejects(verify("not-a-token"));
  await assert.rejects(
    stagingVerifier(f.config, async () => {
      throw Error("offline");
    })(f.token()),
  );
  const other = accessFixture();
  await assert.rejects(verify(other.token()));
});
test("staging HTTP rejects origin bypass and spoofed identity; Access plus assigned local account both required", async () => {
  const folder = mkdtempSync(join(tmpdir(), "jr-stage-http-")),
    path = join(folder, "seed.sqlite");
  seedStaging(path, "owner-review", "synthetic-owner-password");
  const store = new Store(path),
    f = accessFixture(),
    verify = stagingVerifier(f.config, async () => ({ keys: [f.jwk] })),
    server = createApp(store, undefined, f.config, verify);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`,
    headers = {
      Host: "staging.example.invalid",
      "X-Forwarded-Proto": "https",
      "Cf-Access-Jwt-Assertion": f.token(),
    },
    post = (data: any, extra: any = {}) =>
      fetchHTTP(base + "/api/login", {
        method: "POST",
        headers: {
          ...headers,
          Origin: f.config.origin,
          "Content-Type": "application/json",
          ...extra,
        },
        body: JSON.stringify(data),
      });
  try {
    for (const route of [
      "/",
      "/legacy/",
      "/api/state",
      "/api/reports/unknown.pdf",
      "/assets/unknown.js",
    ])
      assert.equal(
        (
          await fetchHTTP(base + route, {
            headers: {
              Host: headers.Host,
              "X-Forwarded-Proto": "https",
              "Cf-Access-Authenticated-User-Email": "owner@example.invalid",
            },
          })
        ).status,
        403,
      );
    assert.equal((await fetchHTTP(base + "/healthz")).status, 200);
    const probe = await fetchHTTP(base + "/api/state", { headers });
    assert.equal(probe.status, 401, await probe.text());
    assert.equal((await fetchHTTP(base + "/legacy/", { headers })).status, 401);
    for (const path of ["/legacy", "/legacy%2f"])
      assert.equal((await fetchHTTP(base + path, { headers })).status, 401);
    assert.equal(
      (await post({ name: "other", password: "synthetic-owner-password" }))
        .status,
      403,
    );
    assert.equal(
      (
        await post(
          { name: "owner-review", password: "synthetic-owner-password" },
          { Origin: "https://evil.invalid" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await post(
          { name: "owner-review", password: "synthetic-owner-password" },
          { Host: "service.up.railway.app" },
        )
      ).status,
      403,
    );
    const login = await post({
      name: "owner-review",
      password: "synthetic-owner-password",
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")!;
    assert.match(cookie, /^__Host-jr_session=/);
    assert.match(cookie, /; Secure/);
    assert.match(cookie, /HttpOnly; SameSite=Strict; Path=\//);
    const signed = { ...headers, Cookie: cookie.split(";")[0] },
      state = await fetchHTTP(base + "/api/state", { headers: signed });
    assert.equal(state.status, 200);
    assert.match(state.headers.get("strict-transport-security")!, /31536000/);
    assert.equal(
      (
        await fetchHTTP(base + "/api/state", {
          headers: {
            ...signed,
            "Cf-Access-Jwt-Assertion": f.token({
              email: "reviewer@example.invalid",
            }),
          },
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetchHTTP(base + "/legacy/", { headers: signed })).status,
      200,
    );
    assert.equal(
      (
        await fetchHTTP(base + "/api/ai/generate", {
          method: "POST",
          headers: {
            ...signed,
            Origin: f.config.origin,
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await fetchHTTP(base + "/api/register", {
          method: "POST",
          headers: {
            ...signed,
            Origin: f.config.origin,
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      404,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
    rmSync(folder, { recursive: true });
  }
});
test("separate encrypted backup restores synthetic data with audit, records and PDF history; tampering and overwrite fail closed", () => {
  const folder = mkdtempSync(join(tmpdir(), "jr-stage-backup-")),
    source = join(folder, "live.sqlite"),
    encrypted = join(folder, "off-volume.jrb"),
    restored = join(folder, "restored.sqlite"),
    password = "synthetic-backup-passphrase";
  try {
    seedStaging(source, "owner-review", "synthetic-owner-password");
    assert.throws(
      () => seedStaging(source, "other", "synthetic-owner-password"),
      /new database/,
    );
    const live = new Store(source),
      token = live.login("owner-review", "synthetic-owner-password")!,
      u = live.user(token)!,
      before = live.snapshot(u);
    encryptStagingBackup(source, encrypted, password);
    assert.ok(
      !readFileSync(encrypted).includes(
        Buffer.from("Synthetic demonstration client"),
      ),
    );
    assert.equal(statSync(encrypted).mode & 0o777, 0o600);
    restoreStagingBackup(encrypted, restored, password);
    const copy = new Store(restored);
    assert.deepEqual(copy.snapshot(u), before);
    assert.equal(copy.user(token), null);
    assert.ok(copy.snapshot(u).records.some((r) => r.kind === "document"));
    copy.close();
    verifyStagingBackup(restored);
    assert.throws(
      () => restoreStagingBackup(encrypted, restored, password),
      /new offline/,
    );
    assert.throws(
      () =>
        restoreStagingBackup(
          encrypted,
          join(folder, "wrong.sqlite"),
          "wrong-passphrase-long-enough",
        ),
      /authentication/,
    );
    assert.ok(!existsSync(join(folder, "wrong.sqlite")));
    const corrupt = readFileSync(encrypted);
    corrupt[60] ^= 1;
    writeFileSync(join(folder, "tampered.jrb"), corrupt);
    assert.throws(
      () =>
        restoreStagingBackup(
          join(folder, "tampered.jrb"),
          join(folder, "bad.sqlite"),
          password,
        ),
      /authentication/,
    );
    live.db.prepare("UPDATE records SET data='{}' WHERE kind='load'").run();
    live.close();
    assert.throws(() => verifyStagingBackup(source), /audit mismatch/);
  } finally {
    rmSync(folder, { recursive: true });
  }
});

function fetchHTTP(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
) {
  return new Promise<Response>((resolve, reject) => {
    const req = request(
      url,
      { method: options.method || "GET", headers: options.headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve(
            new Response(Buffer.concat(chunks), {
              status: res.statusCode,
              headers: res.headers as any,
            }),
          ),
        );
      },
    );
    req.on("error", reject);
    req.end(options.body);
  });
}

test("corrupt PNG data cannot crash asynchronous PDF rendering or enter evidence storage", async () => {
  const folder = mkdtempSync(join(tmpdir(), "jr-png-safety-")),
    path = join(folder, "db.sqlite");
  seedStaging(path, "owner-review", "synthetic-owner-password");
  const store = new Store(path);
  try {
    const u = store.user(
        store.login("owner-review", "synthetic-owner-password")!,
      )!,
      rows = store.snapshot(u).records,
      roof = rows.find((r) => r.kind === "roof")!,
      doc = rows.find((r) => r.kind === "document")!,
      photo = rows.find((r) => r.kind === "photo")!,
      bad =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
      count = store.db.prepare("SELECT count(*) n FROM evidence").get()!.n;
    assert.throws(
      () =>
        store.transaction(() =>
          saveRecord(store, u, roof.pid, "photo", {
            roofId: roof.data.entityId,
            takenAt: new Date().toISOString().slice(0, 10),
            caption: "Synthetic malformed PNG",
            annotations: [],
            image: "data:image/png;base64," + bad,
          }),
        ),
      /PNG/,
    );
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM evidence").get()!.n,
      count,
    );
    store.db
      .prepare("UPDATE evidence SET bytes=? WHERE id=?")
      .run(Buffer.from(bad, "base64"), photo.data.assetId);
    await assert.rejects(renderReport(store, doc), /PNG/);
    assert.equal(store.db.prepare("SELECT 1 alive").get()!.alive, 1);
  } finally {
    store.close();
    rmSync(folder, { recursive: true });
  }
});
