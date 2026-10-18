import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture, roofData, materialData, today } from "./tender-fixture.ts";
import { calculate, current } from "../src/tender.ts";
import { Store } from "../server/store.ts";
import { renderReport } from "../server/report.ts";
import { createApp } from "../server/index.ts";
import { backupDatabase } from "../scripts/backup.ts";

test("takeoff reconciles all cost categories, waste, contingency, sales margin and VAT exactly", () => {
  const f = fixture();
  try {
    const p = f.estimate.data.pricing;
    assert.equal(p.lines[0].quantityMilli, 110000);
    assert.equal(p.subtotals.material, 220000);
    assert.equal(p.subtotals.labour, 40000);
    assert.equal(p.subtotals.plant, 30000);
    assert.equal(p.subtotals.scaffold, 50000);
    assert.equal(p.subtotals.prelims, 10000);
    assert.equal(p.directPence, 350000);
    assert.equal(p.contingencyPence, 35000);
    assert.equal(p.costPence, 385000);
    assert.equal(p.profitPence, 96250);
    assert.equal(p.netPence, 481250);
    assert.equal(p.vatPence, 96250);
    assert.equal(p.grossPence, 577500);
  } finally {
    f.store.close();
  }
});

test("blank rates remain unpriced; explicit zero needs provenance; invalid units, references and rounding rejected", () => {
  const f = fixture();
  try {
    const roofs = current(f.store.snapshot(f.author).records, "roof"),
      materials = [f.material];
    const l = f.estimateData.lines[0];
    const blank = calculate(
      [{ ...l, rate: "", rateSource: "", rateDate: "" }],
      0,
      0,
      0,
      roofs,
      materials,
    );
    assert.equal(blank.netPence, null);
    assert.equal(blank.complete, false);
    assert.equal(
      calculate([{ ...l, rate: "0.00" }], 0, 0, 0, roofs, materials).netPence,
      0,
    );
    for (const bad of [
      { ...l, rateDate: "2100-01-01" },
      { ...l, rate: 20, rateSource: "" },
      { ...l, rate: "1.005" },
      { ...l, quantity: -1, basis: "measured" },
      { ...l, roofId: "other-project" },
      { ...l, unit: "hour" },
      { ...l, waste: 101 },
    ])
      assert.throws(() => calculate([bad], 0, 0, 0, roofs, materials));
    assert.throws(() => calculate([l], 0, 100, 0, roofs, materials));
  } finally {
    f.store.close();
  }
});

test("revisions preserve originals, reject stale edits and stale takeoff approval; worker/viewer cannot write", () => {
  const f = fixture();
  try {
    const revised = f.save("roof", {
      ...roofData,
      area: 120,
      previousId: f.roof.id,
    });
    assert.equal(revised.data.version, 2);
    assert.equal(f.roof.data.area, 100);
    assert.throws(
      () => f.save("roof", { ...roofData, previousId: f.roof.id }),
      /changed/,
    );
    for (const who of [f.worker, f.viewer])
      assert.throws(() => f.save("material", materialData, who), /Forbidden/);
    const document = f.save("document", {
      type: "quotation",
      title: "Stale takeoff",
      estimateId: f.estimate.data.entityId,
    });
    assert.throws(
      () =>
        f.save(
          "approval",
          { documentId: document.id, note: "Review", attest: true },
          f.reviewer,
        ),
      /Takeoff/,
    );
  } finally {
    f.store.close();
  }
});

test("photo validation, immutable blobs, GPS, annotations and cross-roof links", () => {
  const f = fixture();
  try {
    const count = () =>
      Number(f.store.db.prepare("SELECT count(*) AS n FROM evidence").get()!.n);
    assert.equal(count(), 1);
    const base = {
      roofId: f.roof.data.entityId,
      defectId: f.defect.data.entityId,
      takenAt: today(),
      caption: "Test image",
      image: f.image,
      annotations: [],
    };
    for (const bad of [
      { ...base, roofId: f.annexe.data.entityId },
      { ...base, image: "data:image/svg+xml;base64,PHN2Zz4=" },
      {
        ...base,
        annotations: [{ x: 0.9, y: 0, w: 0.2, h: 0.3, label: "Outside" }],
      },
      {
        ...base,
        gps: {
          lat: 91,
          lng: 0,
          accuracy: 1,
          observedAt: new Date().toISOString(),
        },
      },
    ])
      assert.throws(() => f.save("photo", bad));
    assert.equal(count(), 1);
    const revised = f.save("photo", {
      ...f.photo.data,
      gps: undefined,
      previousId: f.photo.id,
      annotations: [{ x: 0, y: 0, w: 0.5, h: 0.5, label: "Revised mark" }],
    });
    assert.equal(revised.data.assetId, f.photo.data.assetId);
    assert.equal(revised.data.gps.lat, 51.88);
    assert.equal(revised.data.annotations.length, 1);
    assert.equal(f.photo.data.annotations[0].label, "Synthetic defect area");
    assert.equal(count(), 1);
  } finally {
    f.store.close();
  }
});

test("document approval is independent, explicit, immutable and bound to current evidence", () => {
  const f = fixture();
  try {
    const doc = f.save("document", {
      type: "quotation",
      title: "Synthetic tender quotation",
      estimateId: f.estimate.data.entityId,
    });
    const approve = {
      documentId: doc.id,
      attest: true,
      note: "Synthetic reviewer checked totals, sources, scope and limitations",
    };
    assert.throws(() => f.save("approval", approve), /independent/);
    assert.throws(
      () => f.save("approval", { ...approve, attest: false }, f.reviewer),
      /Confirm/,
    );
    const approval = f.save("approval", approve, f.reviewer);
    assert.equal(approval.data.fingerprint, doc.data.fingerprint);
    assert.throws(
      () => f.save("approval", approve, f.reviewer),
      /already approved/,
    );
    f.save("roof", {
      ...roofData,
      name: "Revised roof",
      previousId: f.roof.id,
    });
    assert.equal(doc.data.snapshot.roofs[0].data.name, "Main warehouse");
    assert.equal(doc.data.status, "Draft for review");
    const other = f.save("document", { type: "survey", title: "New survey" });
    f.save("defect", {
      ...f.defect.data,
      description: "Later evidence",
      previousId: f.defect.id,
    });
    assert.throws(
      () =>
        f.save("approval", { ...approve, documentId: other.id }, f.reviewer),
      /evidence changed/,
    );
  } finally {
    f.store.close();
  }
});

test("unpriced, expired quotes and overdue material evidence cannot be approved", () => {
  for (const scenario of ["unpriced", "expired", "source"] as const) {
    const f = fixture();
    try {
      let d = { ...f.estimateData };
      if (scenario === "unpriced")
        d.lines = d.lines.map((l) => ({ ...l, rate: "" }));
      if (scenario === "expired") d.validUntil = "2020-01-01";
      if (scenario === "source") {
        const material = f.save("material", {
          ...materialData,
          sourceDate: "2019-01-01",
          validUntil: "2020-01-01",
          previousId: f.material.id,
        });
        assert.ok(material.id);
      }
      const e = f.save("estimate", d);
      const doc = f.save("document", {
        type: "quotation",
        title: "Blocked",
        estimateId: e.data.entityId,
      });
      assert.throws(
        () =>
          f.save(
            "approval",
            { documentId: doc.id, attest: true, note: "Test" },
            f.reviewer,
          ),
        /unpriced|expired|overdue/,
      );
    } finally {
      f.store.close();
    }
  }
});

test("v1 to v2 migration and reopening preserve projects, surveys, evidence and issued snapshots", () => {
  const dir = mkdtempSync(join(tmpdir(), "jr-tender-")),
    path = join(dir, "db.sqlite"),
    f = fixture(path);
  try {
    const document = f.save("document", {
      type: "survey",
      title: "Backup evidence snapshot",
    });
    f.save(
      "approval",
      { documentId: document.id, attest: true, note: "Test snapshot review" },
      f.reviewer,
    );
    const state = f.store.snapshot(f.author),
      asset = f.photo.data.assetId;
    const backupPath = join(dir, "backup.sqlite");
    backupDatabase(path, backupPath);
    const backup = new Store(backupPath);
    assert.equal(
      backup.snapshot(f.author).records.length,
      state.records.length,
    );
    assert.equal(
      backup.db.prepare("SELECT sha256 FROM evidence WHERE id=?").get(asset)
        ?.sha256,
      f.photo.data.sha256,
    );
    assert.ok(
      backup
        .snapshot(f.author)
        .records.some(
          (r) => r.kind === "approval" && r.data.documentId === document.id,
        ),
    );
    backup.close();
    f.store.close();
    const reopened = new Store(path);
    assert.equal(
      reopened.snapshot(f.author).records.length,
      state.records.length,
    );
    assert.equal(
      reopened.db.prepare("SELECT sha256 FROM evidence WHERE id=?").get(asset)
        ?.sha256,
      f.photo.data.sha256,
    );
    reopened.close();
    const v1path = join(dir, "v1.sqlite"),
      v1 = new Store(v1path);
    v1.addUser("migrate", "migration-test-password", "manager");
    const u = v1.user(v1.login("migrate", "migration-test-password")!)!;
    v1.project(u, { name: "Old version project" });
    v1.db.exec("DROP TABLE evidence; DELETE FROM migrations WHERE version=2");
    v1.close();
    const upgraded = new Store(v1path);
    assert.equal(upgraded.snapshot(u).projects[0].name, "Old version project");
    assert.equal(
      upgraded.db.prepare("SELECT count(*) AS n FROM migrations").get()?.n,
      2,
    );
    upgraded.close();
  } finally {
    try {
      f.store.close();
    } catch {}
    rmSync(dir, { recursive: true });
  }
});

test("survey and quotation PDFs embed evidence, preserve revisions and produce real PDF bytes", async () => {
  const f = fixture();
  try {
    mkdirSync("artifacts", { recursive: true });
    const survey = f.save("document", {
        type: "survey",
        title: "Synthetic multi-roof survey",
      }),
      quote = f.save("document", {
        type: "quotation",
        title: "Synthetic tender quotation",
        estimateId: f.estimate.data.entityId,
      });
    const approval = f.save(
      "approval",
      {
        documentId: quote.id,
        attest: true,
        note: "Reviewed synthetic evidence and commercial arithmetic",
      },
      f.reviewer,
    );
    for (const [name, doc, signoff] of [
      ["survey", survey, undefined],
      ["quotation", quote, approval],
    ] as const) {
      const bytes = await renderReport(f.store, doc, signoff);
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      assert.ok(bytes.length > 20000);
      writeFileSync(`artifacts/tender-${name}.pdf`, bytes);
    }
  } finally {
    f.store.close();
  }
});

test("authenticated HTTP evidence and PDF routes enforce project access and report missing evidence clearly", async () => {
  const f = fixture(),
    server = createApp(f.store);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`,
    cookie = "jr_session=" + f.store.login("author", "synthetic-test-password");
  try {
    const doc = f.save("document", { type: "survey", title: "HTTP survey" });
    assert.equal(
      (await fetch(base + "/api/reports/" + doc.id + ".pdf")).status,
      401,
    );
    const r = await fetch(base + "/api/reports/" + doc.id + ".pdf", {
      headers: { Cookie: cookie },
    });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "application/pdf");
    assert.equal(
      Buffer.from(await r.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      "%PDF-",
    );
    const worker =
      "jr_session=" + f.store.login("worker", "synthetic-test-password");
    assert.equal(
      (
        await fetch(base + "/api/evidence/" + f.photo.data.assetId, {
          headers: { Cookie: worker },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(base + "/api/reports/" + doc.id + ".pdf", {
          headers: { Cookie: worker },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(base + "/api/evidence/no-such-id", {
          headers: { Cookie: cookie },
        })
      ).status,
      404,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    f.store.close();
  }
});
