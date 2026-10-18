import type { RecordItem } from "./model.ts";
import { current } from "./tender.ts";
export type GateField = {
  name: string;
  label: string;
  options?: string[];
  type?: string;
  optional?: boolean;
  ref?: string;
};
export const gateSchemas: Record<
  string,
  { title: string; route: string; fields: GateField[] }
> = {
  drawing: {
    title: "Drawing revision register",
    route: "design",
    fields: [
      { name: "number", label: "Drawing number" },
      { name: "revision", label: "Drawing revision" },
      { name: "title", label: "Drawing title" },
      { name: "source", label: "Drawing source reference" },
      {
        name: "purpose",
        label: "Drawing purpose",
        options: ["design", "construction", "as-built"],
      },
    ],
  },
  loadcase: {
    title: "Traceable structural inputs",
    route: "design",
    fields: [
      { name: "title", label: "Load case title" },
      { name: "loadId", label: "Preliminary calculation", ref: "load" },
      { name: "drawingId", label: "Drawing revision", ref: "drawing" },
      {
        name: "assumptions",
        label: "Loading assumptions and limitations",
        type: "textarea",
      },
      { name: "source", label: "Loading source reference" },
      {
        name: "calculationReference",
        label: "Engineer calculation document reference",
      },
    ],
  },
  query: {
    title: "Structural queries",
    route: "design",
    fields: [
      { name: "title", label: "Structural query title" },
      { name: "question", label: "Engineering question", type: "textarea" },
      { name: "loadcaseId", label: "Load case revision", ref: "loadcase" },
      { name: "drawingId", label: "Related drawing revision", ref: "drawing" },
    ],
  },
  rfi: {
    title: "Requests for information",
    route: "design",
    fields: [
      { name: "title", label: "RFI title" },
      { name: "question", label: "RFI question", type: "textarea" },
      { name: "drawingId", label: "RFI drawing revision", ref: "drawing" },
      { name: "due", label: "Response due", type: "date" },
    ],
  },
  mandate: {
    title: "Engineer authorisation",
    route: "design",
    fields: [
      { name: "engineerId", label: "Engineer account ID" },
      { name: "scope", label: "Authorised project scope", type: "textarea" },
      {
        name: "qualificationReference",
        label: "Verified qualification and appointment reference",
      },
      { name: "validUntil", label: "Authorisation valid until", type: "date" },
      {
        name: "active",
        label: "Authorisation state",
        options: ["active", "revoked"],
      },
    ],
  },
  control: {
    title: "Construction controls",
    route: "construction",
    fields: [
      { name: "title", label: "Control title" },
      {
        name: "category",
        label: "Control category",
        options: ["RAMS", "CPP", "scaffold", "working-at-height", "hot-work"],
      },
      { name: "source", label: "Control document reference" },
      {
        name: "method",
        label: "Method, hazards and protective measures",
        type: "textarea",
      },
      {
        name: "rescue",
        label: "Emergency and rescue arrangements",
        type: "textarea",
      },
      { name: "competence", label: "Competent person evidence" },
      {
        name: "validFrom",
        label: "Control valid from (UTC)",
        type: "datetime-local",
      },
      {
        name: "validUntil",
        label: "Control expiry (UTC)",
        type: "datetime-local",
      },
    ],
  },
  workplan: {
    title: "Work scope and permit applicability",
    route: "construction",
    fields: [
      { name: "title", label: "Work scope" },
      { name: "hotWork", label: "Hot work required", options: ["yes", "no"] },
      { name: "scaffold", label: "Scaffold required", options: ["yes", "no"] },
      {
        name: "rationale",
        label: "Permit applicability rationale",
        type: "textarea",
      },
    ],
  },
  programme: {
    title: "Construction programme",
    route: "construction",
    fields: [
      { name: "title", label: "Task title" },
      { name: "baselineStart", label: "Baseline start", type: "date" },
      { name: "baselineEnd", label: "Baseline finish", type: "date" },
      { name: "plannedStart", label: "Current planned start", type: "date" },
      { name: "plannedEnd", label: "Current planned finish", type: "date" },
      {
        name: "dependsOn",
        label: "Predecessor task revision",
        ref: "programme",
        optional: true,
      },
      { name: "progress", label: "Progress percent", type: "number" },
      {
        name: "actualStart",
        label: "Actual start",
        type: "date",
        optional: true,
      },
      {
        name: "actualEnd",
        label: "Actual finish",
        type: "date",
        optional: true,
      },
    ],
  },
  diary: {
    title: "Daily site diary",
    route: "construction",
    fields: [
      { name: "title", label: "Diary title" },
      { name: "date", label: "Site date", type: "date" },
      { name: "weather", label: "Observed weather" },
      { name: "labour", label: "Labour and plant on site" },
      { name: "work", label: "Activities and progress", type: "textarea" },
      {
        name: "events",
        label: "Safety events, delays and instructions",
        type: "textarea",
      },
      { name: "evidence", label: "Diary evidence reference" },
    ],
  },
  holdpoint: {
    title: "Inspection and test plan",
    route: "quality",
    fields: [
      { name: "title", label: "Hold point title" },
      {
        name: "stage",
        label: "Inspection stage",
        options: ["prestart", "installation", "final"],
      },
      { name: "criteria", label: "Acceptance criteria", type: "textarea" },
      { name: "method", label: "Inspection method" },
      { name: "source", label: "ITP specification reference" },
    ],
  },
  snag: {
    title: "Snag register",
    route: "quality",
    fields: [
      { name: "title", label: "Snag title" },
      { name: "location", label: "Snag location" },
      {
        name: "description",
        label: "Defect and required remedy",
        type: "textarea",
      },
      { name: "owner", label: "Responsible person" },
      { name: "due", label: "Remedy due", type: "date" },
      {
        name: "remedy",
        label: "Completed remedy",
        type: "textarea",
        optional: true,
      },
      { name: "evidence", label: "Remedy evidence reference", optional: true },
    ],
  },
  handoverItem: {
    title: "O&M and handover register",
    route: "handover",
    fields: [
      { name: "title", label: "Handover document title" },
      {
        name: "category",
        label: "Handover document category",
        options: [
          "O&M",
          "as-built",
          "warranty",
          "test-certificate",
          "maintenance",
        ],
      },
      { name: "revision", label: "Document revision" },
      { name: "source", label: "Handover source reference" },
      {
        name: "description",
        label: "Document scope and limitations",
        type: "textarea",
      },
    ],
  },
};
export const engineeringKinds = ["drawing", "loadcase", "query", "rfi", "load"];
export function engineeringKey(records: RecordItem[]) {
  return engineeringKinds
    .flatMap((k) => current(records, k).map((r) => r.id))
    .join("|");
}
export function liveMandate(
  records: RecordItem[],
  uid: string,
  now = Date.now(),
) {
  return current(records, "mandate").find(
    (r) =>
      r.data.engineerId === uid &&
      r.data.active === "active" &&
      Date.parse(r.data.validUntil + "T23:59:59Z") >= now,
  );
}
export function engineeringApproval(records: RecordItem[], now = Date.now()) {
  const review = records
    .filter(
      (r) =>
        r.kind === "engineeringReview" &&
        r.data.packageKey === engineeringKey(records),
    )
    .at(-1);
  return review?.data.decision === "accepted" &&
    liveMandate(records, review.author, now)?.id === review.data.mandateId
    ? review
    : undefined;
}
export function reviewFor(
  records: RecordItem[],
  target: RecordItem,
  now = Date.now(),
) {
  const r = records
    .filter((r) => r.kind === "gateReview" && r.data.targetId === target.id)
    .at(-1);
  return r?.data.decision === "accepted" &&
    (!target.data.validUntil || Date.parse(target.data.validUntil) >= now) &&
    (!target.data.validFrom || Date.parse(target.data.validFrom) <= now)
    ? r
    : undefined;
}
export function engineeringBlockers(records: RecordItem[]) {
  const errors: string[] = [];
  for (const k of ["drawing", "loadcase", "query"])
    if (!current(records, k).length) errors.push(`Missing ${k}`);
  for (const load of current(records, "load"))
    if (!current(records, "loadcase").some((r) => r.data.loadId === load.id))
      errors.push(
        "Preliminary load has no traceable engineer-reviewed load case",
      );
  const latestIds = new Set(
    engineeringKinds.flatMap((k) => current(records, k).map((r) => r.id)),
  );
  for (const r of current(records, "loadcase"))
    if (!latestIds.has(r.data.drawingId))
      errors.push("Load case references a superseded drawing");
  for (const k of ["query", "rfi"])
    for (const r of current(records, k))
      for (const f of k === "query"
        ? ["loadcaseId", "drawingId"]
        : ["drawingId"])
        if (!latestIds.has(r.data[f]))
          errors.push(`${k} references a superseded revision`);
  if (!engineeringApproval(records))
    errors.push("Current package requires authorised engineer approval");
  return errors;
}
export function constructionBlockers(
  records: RecordItem[],
  stage: string,
  now = Date.now(),
) {
  const errors = engineeringBlockers(records),
    plan = current(records, "workplan").at(-1);
  if (!plan) errors.push("Work scope and permit applicability missing");
  const categories = [
    "RAMS",
    "CPP",
    "working-at-height",
    ...(plan?.data.scaffold === "yes" ? ["scaffold"] : []),
    ...(plan?.data.hotWork === "yes" ? ["hot-work"] : []),
  ];
  for (const category of categories)
    if (
      !current(records, "control").some(
        (r) =>
          r.data.category === category &&
          reviewFor(records, r, now) &&
          !records.some(
            (c) => c.kind === "permitClose" && c.data.targetId === r.id,
          ),
      )
    )
      errors.push(`${category} requires a current independent review`);
  const points = current(records, "holdpoint");
  for (const s of ["prestart", "installation", "final"])
    if (!points.some((r) => r.data.stage === s))
      errors.push(`Missing mandatory ${s} inspection plan`);
  for (const r of points.filter((r) => r.data.stage === stage))
    if (!reviewFor(records, r, now))
      errors.push(`Inspection pending or failed: ${r.data.title}`);
  return errors;
}
export function releaseKey(records: RecordItem[], stage: string) {
  return [
    ...engineeringKey(records).split("|"),
    ...[
      "mandate",
      "control",
      "workplan",
      "holdpoint",
      "gateReview",
      "engineeringReview",
      "permitClose",
    ].flatMap((k) => current(records, k).map((r) => r.id)),
    stage,
  ].join("|");
}
export function recordedStageRelease(records: RecordItem[], stage: string) {
  const plan = current(records, "workplan").at(-1),
    categories = [
      "RAMS",
      "CPP",
      "working-at-height",
      ...(plan?.data.scaffold === "yes" ? ["scaffold"] : []),
      ...(plan?.data.hotWork === "yes" ? ["hot-work"] : []),
    ];
  const approval = engineeringApproval(records);
  const dependencies = [
    ...(approval ? [{ id: approval.id }, { id: approval.data.mandateId }] : []),
    ...current(records, "control").filter((r) =>
      categories.includes(r.data.category),
    ),
    ...current(records, "holdpoint").filter((r) => r.data.stage === stage),
  ].map((r) => r.id);
  return records
    .filter(
      (r) =>
        r.kind === "workRelease" &&
        r.data.stage === stage &&
        r.data.engineeringKey === engineeringKey(records) &&
        r.data.planKey ===
          current(records, "workplan")
            .map((p) => p.id)
            .join("|") &&
        dependencies.every((id) => r.data.dependencies.includes(id)),
    )
    .at(-1);
}
export function closeoutBlockers(records: RecordItem[]) {
  // Expired temporary permits do not invalidate historical work; releases retain exact evidence.
  const errors = engineeringBlockers(records);
  for (const s of ["prestart", "installation", "final"])
    if (!recordedStageRelease(records, s))
      errors.push(
        `Missing ${s} work release for current design, scope and control revisions`,
      );
  const plan = current(records, "workplan").at(-1),
    categories = [
      "RAMS",
      "CPP",
      "working-at-height",
      ...(plan?.data.scaffold === "yes" ? ["scaffold"] : []),
      ...(plan?.data.hotWork === "yes" ? ["hot-work"] : []),
    ];
  for (const category of categories) {
    const control = current(records, "control").find(
        (r) => r.data.category === category,
      ),
      review = records
        .filter(
          (r) => r.kind === "gateReview" && r.data.targetId === control?.id,
        )
        .at(-1);
    if (!control || review?.data.decision !== "accepted")
      errors.push(`Pending control acceptance: ${category}`);
  }

  for (const s of ["prestart", "installation", "final"])
    if (!current(records, "holdpoint").some((r) => r.data.stage === s))
      errors.push(`Missing ${s} ITP`);
  for (const r of [
    ...current(records, "holdpoint"),
    ...current(records, "snag"),
    ...current(records, "handoverItem"),
  ])
    if (!reviewFor(records, r))
      errors.push(`Pending acceptance: ${r.data.title}`);
  for (const category of [
    "O&M",
    "as-built",
    "warranty",
    "test-certificate",
    "maintenance",
  ])
    if (
      !current(records, "handoverItem").some(
        (r) => r.data.category === category,
      )
    )
      errors.push(`Missing ${category} document`);
  if (!current(records, "drawing").some((r) => r.data.purpose === "as-built"))
    errors.push("As-built drawing revision missing");
  if (
    !current(records, "programme").length ||
    current(records, "programme").some(
      (r) => Number(r.data.progress) !== 100 || !r.data.actualEnd,
    )
  )
    errors.push("Programme tasks must be completed");
  for (const task of current(records, "programme"))
    if (
      task.data.dependsOn &&
      !current(records, "programme").some((r) => r.id === task.data.dependsOn)
    )
      errors.push("Programme references a superseded predecessor revision");
  if (!current(records, "diary").length) errors.push("Site diary missing");
  for (const permit of current(records, "control").filter(
    (r) => r.data.category === "hot-work",
  ))
    if (
      records.some(
        (r) =>
          r.kind === "workRelease" && r.data.dependencies.includes(permit.id),
      ) &&
      !records.some(
        (r) => r.kind === "permitClose" && r.data.targetId === permit.id,
      )
    )
      errors.push("Used hot work permit needs fire watch closeout");
  return errors;
}
export function handoverKey(records: RecordItem[]) {
  return records
    .filter(
      (r) =>
        Object.keys(gateSchemas).includes(r.kind) ||
        [
          "engineeringReview",
          "gateReview",
          "workRelease",
          "permitClose",
          "load",
        ].includes(r.kind),
    )
    .map((r) => r.id)
    .join("|");
}
