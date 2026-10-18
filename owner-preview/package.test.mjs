import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
const root = resolve(
    process.env.JR_PREVIEW_FOLDER ||
      "../windows-review-build/JR-Roofing-Intelligence-Owner-Review",
  ),
  app = join(root, "app");
const { Store } = await import(pathToFileURL(join(app, "server/store.ts"))),
  { createApp } = await import(pathToFileURL(join(app, "server/index.ts"))),
  { seedPreview } = await import(
    pathToFileURL(join(app, "owner-preview/seed.ts"))
  ),
  { engineeringKey, engineeringApproval } = await import(
    pathToFileURL(join(app, "src/gates.ts"))
  );
test("packaged merged backend, database, roles, source evidence and PDF generation work without development dependencies", async () => {
  const folder = mkdtempSync(join(tmpdir(), "JR review spaces & unicode-é-")),
    path = join(folder, "review.sqlite"),
    accounts = [
      ["owner", "manager"],
      ["reviewer", "manager"],
      ["engineer", "engineer"],
      ["supervisor", "supervisor"],
      ["viewer", "viewer"],
    ].map(([name, role]) => ({
      name,
      role,
      password: randomBytes(15).toString("base64url"),
    }));
  seedPreview(
    path,
    accounts,
    readFileSync(join(root, "owner-preview/fictional-roof.png")),
  );
  let store = new Store(path),
    server = createApp(store, join(app, "dist"));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`,
    post = (route, data, cookie = "") =>
      fetch(base + "/api/" + route, {
        method: "POST",
        headers: {
          Origin: base,
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify(data),
      }),
    login = async (name) => {
      const a = accounts.find((a) => a.name === name),
        r = await post("login", { name, password: a.password });
      assert.equal(r.status, 200);
      return r.headers.get("set-cookie").split(";")[0];
    };
  try {
    assert.equal((await fetch(base + "/api/state")).status, 401);
    assert.equal(
      (await post("login", { name: "owner", password: "incorrect" })).status,
      401,
    );
    const owner = await login("owner"),
      reviewer = await login("reviewer"),
      engineer = await login("engineer"),
      viewer = await login("viewer"),
      state = await fetch(base + "/api/state", {
        headers: { Cookie: owner },
      }).then((r) => r.json());
    assert.equal(state.projects.length, 2);
    const project = state.projects.find((p) => p.name.includes("Riverside")),
      records = state.records.filter((r) => r.pid === project.id);
    assert.equal(records.filter((r) => r.kind === "roof").length, 2);
    assert.equal(records.filter((r) => r.kind === "estimate").length, 2);
    assert.equal(
      records.find((r) => r.kind === "estimate").data.pricing.grossPence,
      577500,
    );
    assert.equal(engineeringApproval(records), undefined);
    assert.equal(
      records.find((r) => r.kind === "load").data.status,
      "Preliminary / Not approved",
    );
    assert.equal(
      (
        await post(
          "records",
          {
            pid: project.id,
            kind: "load",
            data: { thickness: 18, density: 650, area: 94, other: 0 },
          },
          viewer,
        )
      ).status,
      403,
    );
    const doc = records.find((r) => r.kind === "document");
    assert.equal(
      (
        await post(
          "records",
          {
            pid: project.id,
            kind: "approval",
            data: { documentId: doc.id, attest: true, note: "Fictional test" },
          },
          owner,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await post(
          "records",
          {
            pid: project.id,
            kind: "engineeringReview",
            data: {
              packageKey: engineeringKey(records),
              decision: "accepted",
              attest: true,
            },
          },
          engineer,
        )
      ).status,
      403,
    );
    const approved = await post(
      "records",
      {
        pid: project.id,
        kind: "approval",
        data: {
          documentId: doc.id,
          attest: true,
          note: "Fictional independent review only",
        },
      },
      reviewer,
    );
    assert.equal(approved.status, 201, await approved.text());
    for (const doc of records.filter((r) => r.kind === "document")) {
      const r = await fetch(base + "/api/reports/" + doc.id + ".pdf", {
        headers: { Cookie: owner },
      });
      assert.equal(r.status, 200);
      const bytes = Buffer.from(await r.arrayBuffer());
      assert.ok(bytes.subarray(0, 5).equals(Buffer.from("%PDF-")));
      assert.ok(bytes.length > 10000);
      assert.equal(
        (await fetch(base + "/api/reports/" + doc.id + ".pdf")).status,
        401,
      );
    }
    const created = await post(
      "projects",
      {
        name: "[FICTIONAL] Saved owner test",
        client: "Fictional",
        address: "Fictional",
        area: 40,
        type: "Commercial",
        roof: "Flat",
      },
      owner,
    );
    assert.equal(created.status, 201);
    await post("logout", {}, owner);
    assert.equal(
      (await fetch(base + "/api/state", { headers: { Cookie: owner } })).status,
      401,
    );
    await new Promise((r) => server.close(r));
    store.close();
    store = new Store(path);
    const who = store.user(store.login("owner", accounts[0].password));
    assert.equal(store.snapshot(who).projects.length, 3);
    assert.equal(
      store.db.prepare("PRAGMA integrity_check").get().integrity_check,
      "ok",
    );
    assert.ok(!existsSync(join(app, "node_modules", "vite")));
    assert.ok(!existsSync(join(root, "ReviewData")));
  } finally {
    await new Promise((r) => server.close(r));
    try {
      store.close();
    } catch {}
    rmSync(folder, { recursive: true, force: true });
  }
});
