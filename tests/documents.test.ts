import { restoreDatabase } from "../scripts/restore.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../server/store.ts";
import { saveRecord, createApp } from "../server/index.ts";
import { documentState } from "../server/documents.ts";
import { backupDatabase } from "../scripts/backup.ts";
import { verifyDatabase } from "../scripts/verify-database.ts";
export function documentFixture(path = ":memory:") {
  const s = new Store(path);
  const users: any = {};
  for (const [name, role] of [
    ["author", "manager"],
    ["reviewer", "manager"],
    ["outsider", "manager"],
    ["viewer", "viewer"],
    ["engineer", "engineer"],
  ]) {
    s.addUser(name, "document-test-password", role as any);
    users[name] = s.user(s.login(name, "document-test-password")!)!;
  }
  const p = s.project(users.author, {
    name: "Synthetic document project",
    client: "Test",
    address: "Test",
    area: 94,
    type: "Commercial",
    roof: "Flat",
  });
  for (const name of ["reviewer", "viewer", "engineer"])
    s.setAccess(
      users.author,
      p.id,
      users[name].id,
      name === "viewer" ? "read" : "write",
    );
  const save = (kind: string, data: any, u = users.author) =>
    s.transaction(() => saveRecord(s, u, p.id, kind, data));
  const records = () => s.snapshot(users.author).records;
  const data = {
    number: "DOC-001",
    revision: "P01",
    title: "Synthetic RAMS review",
    category: "RAMS",
    content: "Manual synthetic method, not approved work.",
    limitations: "Requires qualified review before use.",
    suggestions: "Consider additional inspection.",
    sourceIds: [],
    claims: [],
    file: {
      name: "method.txt",
      base64: Buffer.from("Synthetic attachment").toString("base64"),
    },
  };
  const status = (d: any) => documentState(s, records(), d).status;
  const submit = (d: any, u = users.author) =>
    save(
      "documentSubmit",
      { documentId: d.id, note: "Ready for independent review", attest: true },
      u,
    );
  const review = (d: any, u = users.reviewer, decision = "approved") =>
    save(
      "documentReview",
      {
        documentId: d.id,
        versionId: d.id,
        revision: d.data.revision,
        decision,
        note: "Checked exact revision",
        source: "SYN-REVIEW-01",
        attest: true,
      },
      u,
    );
  return { s, p, users, save, records, data, status, submit, review };
}
test("document lifecycle: independent human review, immutable history, revision and withdrawal", () => {
  const f = documentFixture();
  try {
    const d = f.save("controlledDocument", f.data);
    assert.equal(f.status(d), "Draft");
    assert.throws(() => f.review(d), /applicable/);
    f.submit(d);
    assert.throws(() => f.review(d, f.users.author), /contributors/);
    assert.throws(() => f.review(d, f.users.engineer), /manager/);
    f.review(d);
    assert.equal(f.status(d), "Approved for document use");
    f.review(d, f.users.reviewer, "withdrawn");
    assert.equal(f.status(d), "Approval withdrawn");
    const next = f.save(
      "controlledDocument",
      { ...f.data, revision: "P02", previousId: d.id },
      f.users.reviewer,
    );
    assert.equal(f.status(d), "Superseded");
    f.submit(next, f.users.reviewer);
    assert.throws(() => f.review(next, f.users.author), /contributors/);
    assert.throws(
      () =>
        f.save("controlledDocument", {
          ...f.data,
          revision: "P03",
          previousId: d.id,
        }),
      /changed/,
    );
    assert.equal(
      f.records().filter((r) => r.kind === "documentReview").length,
      2,
    );
  } finally {
    f.s.close();
  }
});
test("source changes and reviewer permission changes permanently invalidate document approval", () => {
  const f = documentFixture();
  try {
    const source = f.save("controlledDocument", {
      ...f.data,
      number: "SOURCE",
    });
    f.submit(source);
    f.review(source);
    const d = f.save("controlledDocument", {
      ...f.data,
      sourceIds: [source.id],
      claims: [
        {
          text: "Source-linked statement",
          sourceId: source.id,
          locator: "Section 1",
        },
      ],
    });
    f.submit(d);
    f.review(d);
    f.save("controlledDocument", {
      ...f.data,
      number: "SOURCE",
      revision: "P02",
      previousId: source.id,
    });
    assert.equal(f.status(d), "Stale sources");
    const other = f.save("controlledDocument", { ...f.data, number: "OTHER" });
    f.submit(other);
    f.review(other);
    f.s.setAccess(f.users.author, f.p.id, f.users.reviewer.id, "none");
    f.s.setAccess(f.users.author, f.p.id, f.users.reviewer.id, "write");
    assert.equal(f.status(other), "Reviewer authority revoked");
  } finally {
    f.s.close();
  }
});
test("attachments and mutations fail closed and rollback without orphan blobs", () => {
  const f = documentFixture();
  try {
    const before = f.s.db
      .prepare("SELECT count(*) n FROM document_files")
      .get()!.n;
    for (const file of [
      { name: "../bad.txt", base64: "YQ==" },
      { name: "bad.txt", base64: "YQ" },
      { name: "bad.txt", base64: "AA==" },
      {
        name: "bad.pdf",
        base64: Buffer.from("%PDF-1.4\n/JavaScript startxref\n%%EOF").toString(
          "base64",
        ),
      },
    ])
      assert.throws(() => f.save("controlledDocument", { ...f.data, file }));
    assert.throws(() => f.save("controlledDocument", { ...f.data, title: "" }));
    assert.equal(
      f.s.db.prepare("SELECT count(*) n FROM document_files").get()!.n,
      before,
    );
    assert.throws(
      () => f.save("controlledDocument", f.data, f.users.viewer),
      /Forbidden/,
    );
    assert.throws(
      () => f.save("controlledDocument", f.data, f.users.outsider),
      /Forbidden/,
    );
    assert.throws(
      () => f.s.setAccess(f.users.author, f.p.id, f.users.author.id, "none"),
      /administrator/,
    );
  } finally {
    f.s.close();
  }
});
test("authenticated document access, project isolation, current PDF and disabled AI", async () => {
  const f = documentFixture(),
    server = createApp(f.s, resolve("dist"));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const cookie = (name: string) =>
    "jr_session=" + f.s.login(name, "document-test-password");
  try {
    const d = f.save("controlledDocument", f.data);
    for (const path of [
      "/api/document-files/" + d.data.fileId,
      "/api/controlled-document-pdf/" + d.id,
      "/api/document-status/" + f.p.id,
    ]) {
      assert.equal((await fetch(base + path)).status, 401);
      assert.equal(
        (await fetch(base + path, { headers: { Cookie: cookie("outsider") } }))
          .status,
        404,
      );
      assert.equal(
        (await fetch(base + path, { headers: { Cookie: cookie("viewer") } }))
          .status,
        200,
      );
    }
    const pdf = await fetch(base + "/api/controlled-document-pdf/" + d.id, {
      headers: { Cookie: cookie("author") },
    });
    assert.equal(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      "%PDF-",
    );
    const ai = await fetch(base + "/api/ai/generate", {
      method: "POST",
      headers: {
        Origin: base,
        Cookie: cookie("author"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pid: f.p.id }),
    });
    assert.equal(ai.status, 409);
    assert.equal(((await ai.json()) as any).code, "AI_DISABLED");
    f.s.db
      .prepare("UPDATE document_files SET bytes=? WHERE id=?")
      .run(Buffer.from("corrupt"), d.data.fileId);
    assert.equal(
      (
        await fetch(base + "/api/document-files/" + d.data.fileId, {
          headers: { Cookie: cookie("author") },
        })
      ).status,
      409,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    f.s.close();
  }
});
test("verified backup restores documents, permissions and history; tampered audit fails validation", () => {
  const dir = mkdtempSync(join(tmpdir(), "jr-doc-backup-")),
    path = join(dir, "source.sqlite"),
    target = join(dir, "backup.sqlite"),
    f = documentFixture(path);
  try {
    const d = f.save("controlledDocument", f.data);
    f.submit(d);
    f.review(d);
    backupDatabase(path, target);
    assert.equal(verifyDatabase(target), true);
    const recovered = join(dir, "restored.sqlite");
    restoreDatabase(target, recovered);
    assert.throws(() => restoreDatabase(target, recovered), /new file/);
    const restored = new Store(recovered);
    assert.equal(
      restored.db.prepare("SELECT count(*) n FROM sessions").get()!.n,
      0,
    );
    assert.equal(
      documentState(restored, restored.snapshot(f.users.author).records, d)
        .status,
      "Approved for document use",
    );
    assert.equal(restored.snapshot(f.users.outsider).projects.length, 0);
    restored.close();
    f.s.db.exec("UPDATE audit SET detail='{}' WHERE seq=1");
    assert.throws(() => verifyDatabase(path), /Audit chain/);
  } finally {
    f.s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
