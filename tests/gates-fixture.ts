import { Store } from "../server/store.ts";
import { saveRecord } from "../server/index.ts";
import type { User } from "../src/model.ts";
import { current } from "../src/tender.ts";
import { engineeringKey, releaseKey, handoverKey } from "../src/gates.ts";
export const today = () => new Date().toISOString().slice(0, 10);
export const future = () =>
  new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
export const past = () =>
  new Date(Date.now() - 86400000).toISOString().slice(0, 16);
export const controlData = (category: string) => ({
  title: "Synthetic " + category,
  category,
  source: "SYNTHETIC-" + category + "-01",
  method:
    "Synthetic controlled method, exclusions, load distribution and protected access",
  rescue: "Synthetic rescue and emergency plan",
  competence: "SYNTHETIC competent person file",
  validFrom: past(),
  validUntil: future() + "T23:59",
});
export function gateFixture(path = ":memory:") {
  const store = new Store(path),
    users: Record<string, User> = {};
  for (const [name, role] of [
    ["author", "manager"],
    ["reviewer", "manager"],
    ["engineer", "engineer"],
    ["supervisor", "supervisor"],
    ["worker", "worker"],
    ["viewer", "viewer"],
  ] as const) {
    store.addUser(name, "synthetic-test-password", role);
    users[name] = store.user(store.login(name, "synthetic-test-password")!)!;
  }
  const project = store.project(users.author, {
    name: "Synthetic controlled roofing project",
    client: "Synthetic client",
    address: "Test facility",
    area: 94,
    type: "Commercial",
    roof: "Flat",
  });
  const records = () =>
    store.snapshot(users.author).records.filter((r) => r.pid === project.id);
  const save = (kind: string, data: any, who = users.author) =>
    store.transaction(() => saveRecord(store, who, project.id, kind, data));
  const load = save("load", {
    thickness: 18,
    density: 650,
    area: 94,
    other: 0.25,
  });
  const drawing = save("drawing", {
    number: "SYN-D-001",
    revision: "A",
    title: "Synthetic roof and loading layout",
    source: "SYNTHETIC controlled drawing A",
    purpose: "as-built",
  });
  const loadcase = save("loadcase", {
    title: "18mm OSB construction-stage loading",
    loadId: load.id,
    drawingId: drawing.id,
    assumptions:
      "Existing sheets, services, OSB, temporary stacking and sequence require engineer review",
    source: "SYNTHETIC measured board data",
    calculationReference:
      "SYNTHETIC-CALC-A (not a real engineering calculation)",
  });
  const query = save("query", {
    title: "18mm OSB safety query",
    question:
      "Review actual boards, existing sheets, services and safe temporary sequence",
    loadcaseId: loadcase.id,
    drawingId: drawing.id,
  });
  const rfi = save("rfi", {
    title: "Roof loading clarification",
    question: "Confirm construction sequence and temporary support arrangement",
    drawingId: drawing.id,
    due: future(),
  });
  const authorise = () =>
    save("mandate", {
      engineerId: users.engineer.id,
      scope: "Synthetic roof package only",
      qualificationReference:
        "SYNTHETIC qualifications and signed appointment checked externally",
      validUntil: future(),
      active: "active",
      attest: true,
    });
  const engineering = (decision = "accepted") =>
    save(
      "engineeringReview",
      {
        packageKey: engineeringKey(records()),
        decision,
        responses: [
          ...current(records(), "query"),
          ...current(records(), "rfi"),
        ].map((r) => ({
          queryId: r.id,
          response:
            "SYNTHETIC engineer response with limitations and sequence; not real authorisation",
        })),
        source: "SYNTHETIC signed engineer review",
        note: "Synthetic explicit professional decision fixture only",
        attest: true,
      },
      users.engineer,
    );
  const inspect = (
    targetId: string,
    decision = "accepted",
    who = users.reviewer,
  ) =>
    save(
      "gateReview",
      {
        targetId,
        decision,
        note: "SYNTHETIC inspection findings against criteria",
        source: "SYNTHETIC inspection photograph or signed source",
        competence: "SYNTHETIC competence record",
        attest: true,
      },
      who,
    );
  const prepareWork = (hotWork = "no") => {
    save("workplan", {
      title: "Synthetic controlled roof works",
      hotWork,
      scaffold: "yes",
      rationale: "Synthetic access selection and permit scope",
    });
    const controls = [
      "RAMS",
      "CPP",
      "working-at-height",
      "scaffold",
      ...(hotWork === "yes" ? ["hot-work"] : []),
    ].map((c) => save("control", controlData(c)));
    for (const r of controls) inspect(r.id);
    const points = ["prestart", "installation", "final"].map((stage) =>
      save("holdpoint", {
        title: "Synthetic " + stage + " inspection",
        stage,
        criteria: "Synthetic approved specification acceptance criteria",
        method: "Recorded visual and measured verification",
        source: "SYNTHETIC-ITP-01",
      }),
    );
    for (const r of points) inspect(r.id);
    return { controls, points };
  };
  const release = (stage: string) =>
    save(
      "workRelease",
      {
        stage,
        packageKey: releaseKey(records(), stage),
        note: "Synthetic human work release only",
        attest: true,
      },
      users.supervisor,
    );
  const prepareHandover = () => {
    const task = save("programme", {
      title: "Synthetic roofing task",
      baselineStart: today(),
      baselineEnd: today(),
      plannedStart: today(),
      plannedEnd: today(),
      progress: "100",
      actualStart: today(),
      actualEnd: today(),
    });
    save("diary", {
      title: "Synthetic daily diary",
      date: today(),
      weather: "Observed dry, no live weather service",
      labour: "Synthetic labour and plant log",
      work: "Synthetic roof inspection and installation",
      events: "Synthetic no events recorded",
      evidence: "SYNTHETIC-SITE-01",
    });
    const snag = save("snag", {
      title: "Synthetic flashing snag",
      location: "Test ridge",
      description: "Synthetic gap remedied",
      owner: "Test installer",
      due: future(),
      remedy: "Synthetic reworked flashing",
      evidence: "SYNTHETIC REMEDY PHOTO",
    });
    inspect(snag.id);
    const items = [
      "O&M",
      "as-built",
      "warranty",
      "test-certificate",
      "maintenance",
    ].map((category) =>
      save("handoverItem", {
        title: "Synthetic " + category,
        category,
        revision: "A",
        source: "SYNTHETIC signed controlled " + category,
        description: "Synthetic document evidence, not real certification",
      }),
    );
    for (const r of items) inspect(r.id);
    return { task, snag, items };
  };
  const handover = () =>
    save(
      "handoverAcceptance",
      {
        packageKey: handoverKey(records()),
        clientName: "SYNTHETIC client",
        clientEvidence: "SYNTHETIC signed client acceptance",
        clientAcceptedAt: today(),
        note: "Synthetic independent manager acceptance",
        attest: true,
      },
      users.reviewer,
    );
  return {
    store,
    users,
    project,
    records,
    save,
    load,
    drawing,
    loadcase,
    query,
    rfi,
    authorise,
    engineering,
    inspect,
    prepareWork,
    release,
    prepareHandover,
    handover,
  };
}
