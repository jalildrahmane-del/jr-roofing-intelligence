import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store.ts";
import { createApp, saveRecord } from "../server/index.ts";
import { current } from "../src/tender.ts";
import {
  engineeringKey,
  engineeringApproval,
  engineeringBlockers,
  constructionBlockers,
  closeoutBlockers,
  handoverKey,
  releaseKey,
  reviewFor,
} from "../src/gates.ts";
import {
  gateFixture,
  controlData,
  future,
  today,
  past,
} from "./gates-fixture.ts";

test("18mm OSB remains pending until independent authorised human engineer answers every query", () => {
  const f = gateFixture();
  try {
    assert.equal(f.load.data.status, "Preliminary / Not approved");
    assert.equal(engineeringApproval(f.records()), undefined);
    assert.throws(() => f.engineering(), /authorisation/);
    const mandate = f.authorise();
    const payload = {
      packageKey: engineeringKey(f.records()),
      decision: "accepted",
      note: "Manual decision",
      source: "signed evidence",
      attest: true,
      responses: [{ queryId: f.query.id, response: "answer" }],
    };
    for (const who of [
      f.users.author,
      f.users.supervisor,
      f.users.viewer,
      f.users.worker,
    ])
      assert.throws(
        () => f.save("engineeringReview", payload, who),
        /Forbidden/,
      );
    assert.throws(
      () => f.save("engineeringReview", payload, f.users.engineer),
      /every structural query/,
    );
    assert.throws(
      () =>
        f.save(
          "engineeringReview",
          { ...payload, attest: false },
          f.users.engineer,
        ),
      /attestation/,
    );
    const review = f.engineering();
    assert.equal(engineeringApproval(f.records())?.id, review.id);
    assert.deepEqual(engineeringBlockers(f.records()), []);
    assert.equal(review.author, f.users.engineer.id);
    assert.equal(review.data.actor.role, "engineer");
    assert.equal(
      f.records().find((r) => r.id === f.load.id)?.data.status,
      "Preliminary / Not approved",
    );
    f.save("mandate", {
      ...mandate.data,
      previousId: mandate.id,
      active: "revoked",
      attest: true,
    });
    assert.equal(engineeringApproval(f.records()), undefined);
    assert.throws(() => f.engineering(), /authorisation/);
  } finally {
    f.store.close();
  }
});
test("immutable superseded drawings, stale dependencies, stale review keys and self engineering review are rejected", () => {
  const f = gateFixture();
  try {
    f.authorise();
    f.engineering();
    assert.throws(() => f.save("drawing", f.drawing.data), /already recorded/);
    const drawing = f.save("drawing", {
      ...f.drawing.data,
      previousId: f.drawing.id,
      revision: "B",
    });
    assert.equal(f.records().filter((r) => r.kind === "drawing").length, 2);
    assert.equal(current(f.records(), "drawing")[0].id, drawing.id);
    assert.equal(engineeringApproval(f.records()), undefined);
    assert.ok(
      engineeringBlockers(f.records()).some((s) => s.includes("superseded")),
    );
    assert.throws(() => f.engineering(), /superseded/);
    assert.throws(
      () =>
        f.save("drawing", {
          ...drawing.data,
          previousId: f.drawing.id,
          revision: "C",
        }),
      /superseded/,
    );
    assert.throws(
      () =>
        f.save(
          "engineeringReview",
          { packageKey: "old", attest: true },
          f.users.engineer,
        ),
      /changed/,
    );
    f.save(
      "rfi",
      { ...f.rfi.data, previousId: f.rfi.id, drawingId: drawing.id },
      f.users.engineer,
    );
    assert.throws(() => f.engineering(), /independent engineer/);
  } finally {
    f.store.close();
  }
});
test("construction release requires current controls, independent inspection, plan and all stage hold points", () => {
  const f = gateFixture();
  try {
    f.authorise();
    f.engineering();
    assert.throws(() => f.release("prestart"), /scope|RAMS/);
    const { controls, points } = f.prepareWork();
    assert.deepEqual(constructionBlockers(f.records(), "prestart"), []);
    assert.throws(
      () => f.inspect(controls[0].id, "accepted", f.users.author),
      /independent/,
    );
    assert.throws(() => f.release("installation"), /preceding/);
    f.inspect(points[0].id, "failed");
    assert.throws(() => f.release("prestart"), /pending or failed/);
    f.inspect(points[0].id);
    f.release("prestart");
    const revised = f.save("control", {
      ...controls[0].data,
      previousId: controls[0].id,
      source: "SYNTHETIC RAMS B",
    });
    assert.throws(() => f.release("installation"), /RAMS/);
    assert.ok(
      closeoutBlockers(f.records()).some((s) =>
        s.includes("current design, scope and control revisions"),
      ),
    );
    f.inspect(revised.id);
    assert.throws(() => f.release("installation"), /preceding/);
    f.release("prestart");
    f.release("installation");
    const expired = f.save("control", {
      ...revised.data,
      previousId: revised.id,
      validFrom: "2000-01-01T00:00",
      validUntil: "2000-01-02T00:00",
    });
    assert.throws(() => f.inspect(expired.id), /expired/);
    assert.throws(() => f.release("final"), /RAMS/);
    assert.throws(() => f.save("control", controlData("RAMS")), /Revise/);
    assert.throws(
      () =>
        f.save(
          "workRelease",
          { stage: "prestart", packageKey: "forged", attest: true },
          f.users.supervisor,
        ),
      /changed/,
    );
  } finally {
    f.store.close();
  }
});
test("hot work requires a reviewed permit and independent fire-watch closeout before handover", () => {
  const f = gateFixture();
  try {
    f.authorise();
    f.engineering();
    const { controls } = f.prepareWork("yes"),
      permit = controls.at(-1)!;
    assert.throws(
      () =>
        f.save(
          "permitClose",
          { targetId: permit.id, attest: true },
          f.users.reviewer,
        ),
      /not been used/,
    );
    for (const stage of ["prestart", "installation", "final"]) f.release(stage);
    f.prepareHandover();
    assert.ok(
      closeoutBlockers(f.records()).some((s) => s.includes("fire watch")),
    );
    assert.throws(() => f.handover(), /fire watch/);
    assert.throws(
      () =>
        f.save(
          "permitClose",
          { targetId: permit.id, attest: true },
          f.users.author,
        ),
      /independent/,
    );
    assert.throws(
      () =>
        f.save(
          "permitClose",
          {
            targetId: permit.id,
            completedAt: past(),
            note: "Synthetic findings",
            source: "SYNTHETIC evidence",
            attest: true,
          },
          f.users.reviewer,
        ),
      /latest work release/,
    );
    f.save(
      "permitClose",
      {
        targetId: permit.id,
        completedAt: new Date().toISOString(),
        note: "Synthetic fire-watch inspection clear",
        source: "SYNTHETIC watch record",
        attest: true,
      },
      f.users.reviewer,
    );
    assert.deepEqual(closeoutBlockers(f.records()), []);
    assert.throws(() => f.release("final"), /hot-work/);
    f.handover();
  } finally {
    f.store.close();
  }
});
test("mandatory QA, snag remedies, O&M, programme and external client evidence gate independent handover", () => {
  const f = gateFixture();
  try {
    f.authorise();
    f.engineering();
    f.prepareWork();
    for (const stage of ["prestart", "installation", "final"]) f.release(stage);
    assert.throws(() => f.handover(), /O&M/);
    const { snag, items } = f.prepareHandover();
    assert.deepEqual(closeoutBlockers(f.records()), []);
    const acceptance = f.handover();
    assert.equal(acceptance.data.packageKey, handoverKey(f.records()));
    assert.match(acceptance.data.digest, /^[a-f0-9]{64}$/);
    const revise = f.save("snag", {
      ...snag.data,
      previousId: snag.id,
      remedy: "",
      evidence: "",
    });
    assert.throws(() => f.inspect(revise.id), /remedy/);
    assert.throws(() => f.handover(), /Pending acceptance/);
    assert.notEqual(acceptance.data.packageKey, handoverKey(f.records()));
    const remedied = f.save("snag", {
      ...revise.data,
      previousId: revise.id,
      remedy: "Synthetic revised remedy",
      evidence: "SYNTHETIC new photo",
    });
    f.inspect(remedied.id);
    f.inspect(items[0].id, "failed");
    assert.throws(() => f.handover(), /Pending acceptance/);
    f.inspect(items[0].id);
    assert.throws(
      () =>
        f.save(
          "handoverAcceptance",
          { packageKey: handoverKey(f.records()), attest: true },
          f.users.author,
        ),
      /independent manager/,
    );
    assert.throws(
      () =>
        f.save(
          "handoverAcceptance",
          {
            packageKey: handoverKey(f.records()),
            attest: true,
            note: "Synthetic review",
            clientName: "Client",
            clientAcceptedAt: today(),
          },
          f.users.reviewer,
        ),
      /Signed client acceptance/,
    );
    f.handover();
  } finally {
    f.store.close();
  }
});
test("controls and dates fail closed; task dependencies cannot cycle or bypass predecessor progress", () => {
  const f = gateFixture();
  try {
    assert.throws(
      () =>
        f.save("control", {
          ...controlData("CPP"),
          validFrom: "2026-02-31T12:00",
        }),
      /Invalid/,
    );
    assert.throws(
      () =>
        f.save("control", {
          ...controlData("CPP"),
          validUntil: "2000-01-01T12:00",
        }),
      /expiry/,
    );
    const c = f.save("control", {
      ...controlData("CPP"),
      validFrom: future() + "T00:00",
      validUntil: future() + "T12:00",
    });
    f.inspect(c.id);
    assert.equal(reviewFor(f.records(), c), undefined);
    const taskData = {
      title: "Task A",
      baselineStart: today(),
      baselineEnd: today(),
      plannedStart: today(),
      plannedEnd: today(),
      progress: "0",
    };
    const a = f.save("programme", taskData),
      b = f.save("programme", {
        ...taskData,
        title: "Task B",
        dependsOn: a.id,
      });
    assert.throws(
      () =>
        f.save("programme", { ...a.data, previousId: a.id, dependsOn: b.id }),
      /cycle/,
    );
    assert.throws(
      () => f.save("programme", { ...b.data, previousId: b.id, progress: "5" }),
      /Predecessor/,
    );
    assert.throws(
      () =>
        f.save("programme", { ...a.data, previousId: a.id, progress: "100" }),
      /actual finish/,
    );
    assert.throws(
      () =>
        f.save("mandate", {
          engineerId: f.users.supervisor.id,
          scope: "scope",
          qualificationReference: "ref",
          validUntil: future(),
          active: "active",
          attest: true,
        }),
      /existing engineer/,
    );
  } finally {
    f.store.close();
  }
});
test("approval records persist across restart and the hash-linked audit identifies server-owned actors", () => {
  const folder = mkdtempSync(join(tmpdir(), "jr-gates-")),
    path = join(folder, "test.sqlite"),
    f = gateFixture(path);
  let reopened: Store | undefined;
  try {
    f.authorise();
    f.engineering();
    f.prepareWork();
    for (const stage of ["prestart", "installation", "final"]) f.release(stage);
    f.prepareHandover();
    const acceptance = f.handover(),
      count = f.records().length;
    f.store.close();
    reopened = new Store(path);
    const rows = reopened.snapshot(f.users.author).records;
    assert.equal(rows.length, count);
    assert.equal(rows.at(-1)?.id, acceptance.id);
    assert.equal(engineeringApproval(rows)?.author, f.users.engineer.id);
    assert.ok(
      Number(reopened.db.prepare("SELECT count(*) n FROM audit").get()!.n) >
        count,
    );
    assert.deepEqual(closeoutBlockers(rows), []);
  } finally {
    reopened?.close();
    rmSync(folder, { recursive: true });
  }
});
test("HTTP role checks reject forged certification; dossier export contains history and audit but no credentials", async () => {
  const f = gateFixture(),
    server = createApp(f.store);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const cookie = (name: string) =>
    "jr_session=" + f.store.login(name, "synthetic-test-password");
  const send = (kind: string, data: any, who: string) =>
    fetch(base + "/api/records", {
      method: "POST",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        Cookie: cookie(who),
      },
      body: JSON.stringify({ pid: f.project.id, kind, data }),
    });
  try {
    for (const who of ["author", "supervisor", "viewer"])
      assert.equal(
        (
          await send(
            "engineeringReview",
            { attest: true, decision: "accepted" },
            who,
          )
        ).status,
        403,
      );
    f.authorise();
    f.engineering();
    const rev = await send(
      "workRelease",
      {
        attest: true,
        stage: "prestart",
        packageKey: releaseKey(f.records(), "prestart"),
        author: f.users.engineer.id,
        status: "Certified",
      },
      "author",
    );
    assert.equal(rev.status, 400);
    const url = base + "/api/dossiers/" + f.project.id;
    assert.equal((await fetch(url)).status, 401);
    assert.equal(
      (await fetch(url, { headers: { Cookie: cookie("worker") } })).status,
      403,
    );
    const response = await fetch(url, {
      headers: { Cookie: cookie("viewer") },
    });
    assert.equal(response.status, 200);
    const body: any = await response.json();
    assert.equal(body.records.length, f.records().length);
    assert.ok(body.audit.length > body.records.length);
    assert.equal(
      body.records.find((r: any) => r.kind === "engineeringReview").author,
      f.users.engineer.id,
    );
    assert.ok(!JSON.stringify(body).includes("synthetic-test-password"));
    assert.ok(!("sessions" in body));
    assert.equal(
      (
        await fetch(base + "/api/dossiers/unknown", {
          headers: { Cookie: cookie("author") },
        })
      ).status,
      404,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    f.store.close();
  }
});

test("unused hot-work control does not become a used permit merely because unrelated work was released", () => {
  const f = gateFixture();
  try {
    f.authorise();
    f.engineering();
    f.prepareWork("no");
    const permit = f.save("control", controlData("hot-work"));
    for (const stage of ["prestart", "installation", "final"]) {
      const release = f.release(stage);
      assert.ok(!release.data.dependencies.includes(permit.id));
    }
    f.prepareHandover();
    assert.deepEqual(closeoutBlockers(f.records()), []);
    f.handover();
  } finally {
    f.store.close();
  }
});
