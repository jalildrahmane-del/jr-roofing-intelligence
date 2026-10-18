import { randomUUID, createHash } from "node:crypto";
import type { User, RecordItem } from "../src/model.ts";
import { Store } from "./store.ts";
import { text } from "../src/model.ts";
import { current, choice, date, decimal } from "../src/tender.ts";
import {
  gateSchemas,
  engineeringKinds,
  engineeringKey,
  engineeringBlockers,
  liveMandate,
  constructionBlockers,
  closeoutBlockers,
  releaseKey,
  handoverKey,
  recordedStageRelease,
} from "../src/gates.ts";
const allowed = ["manager", "engineer", "supervisor"];
function requireRole(u: User, roles: string[]) {
  if (!roles.includes(u.role))
    throw Error("Forbidden: authorised " + roles.join(" or ") + " required");
}
function attest(d: any) {
  if (d.attest !== true) throw Error("Explicit human attestation required");
}
function ensureEmpty(errors: string[]) {
  if (errors.length) throw Error(errors.join("; "));
}
function time(value: unknown, label: string) {
  const t = text(value, label, 50);
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{3})?Z)?$/.test(t) ||
    !Number.isFinite(Date.parse(t))
  )
    throw Error("Invalid " + label);
  const result = new Date(t.endsWith("Z") ? t : t + "Z").toISOString();
  if (result.slice(0, 16) !== t.slice(0, 16)) throw Error("Invalid " + label);
  return result;
}
export function saveGate(
  store: Store,
  u: User,
  pid: string,
  kind: string,
  d: any,
): RecordItem | undefined {
  if (
    !Object.hasOwn(gateSchemas, kind) &&
    ![
      "engineeringReview",
      "gateReview",
      "workRelease",
      "permitClose",
      "handoverAcceptance",
    ].includes(kind)
  )
    return;
  requireRole(u, allowed);
  const records = store.snapshot(u).records.filter((r) => r.pid === pid),
    append = (data: any) =>
      store.append(u, pid, kind, {
        ...data,
        actor: { id: u.id, name: u.name, role: u.role },
      });
  const ref = (id: unknown, kinds: string[], latest = true) => {
    const r = records.find((r) => r.id === id && kinds.includes(r.kind));
    if (!r || (latest && !current(records, r.kind).some((x) => x.id === r.id)))
      throw Error("Missing or superseded " + kinds.join("/") + " reference");
    return r;
  };
  if (Object.hasOwn(gateSchemas, kind)) {
    if (kind === "mandate") requireRole(u, ["manager"]);
    if (["drawing", "loadcase", "query", "rfi"].includes(kind))
      requireRole(u, ["manager", "engineer"]);
    const previous = d.previousId ? ref(d.previousId, [kind]) : undefined;
    const out: any = {
      entityId: previous?.data.entityId || randomUUID(),
      version: (previous?.data.version || 0) + 1,
      previousId: previous?.id || "",
    };
    for (const f of gateSchemas[kind].fields) {
      let value = d[f.name];
      if (f.optional && (value == null || value === "")) {
        out[f.name] = "";
        continue;
      }
      if (f.ref) {
        out[f.name] = ref(value, [f.ref]).id;
        continue;
      }
      out[f.name] = f.options
        ? choice(value, f.options, f.label)
        : f.type === "date"
          ? date(value, f.label)
          : f.type === "datetime-local"
            ? time(value, f.label)
            : f.type === "number"
              ? decimal(value, f.label, 100, 2)
              : text(value, f.label);
    }
    if (kind === "control") {
      if (previous && previous.data.category !== out.category)
        throw Error("Control category cannot change");
      if (
        current(records, "control").some(
          (r) =>
            r.data.category === out.category &&
            r.data.entityId !== out.entityId,
        )
      )
        throw Error("Revise the existing control category");
      if (out.validUntil <= out.validFrom)
        throw Error("Control expiry must follow its start");
    }
    if (
      kind === "workplan" &&
      current(records, "workplan").some((r) => r.data.entityId !== out.entityId)
    )
      throw Error("Revise the existing work scope");
    if (kind === "mandate") {
      const engineer = store.db
        .prepare("SELECT role FROM users WHERE id=?")
        .get(out.engineerId) as any;
      if (engineer?.role !== "engineer")
        throw Error("Authorisation requires an existing engineer account");
      if (
        current(records, "mandate").some(
          (r) =>
            r.data.engineerId === out.engineerId &&
            r.data.entityId !== out.entityId,
        )
      )
        throw Error("Revise the existing engineer authorisation");
      if (previous && previous.data.engineerId !== out.engineerId)
        throw Error("Engineer identity cannot change");
      attest(d);
      out.attest = true;
    }
    if (
      kind === "drawing" &&
      records.some(
        (r) =>
          r.kind === "drawing" &&
          r.data.number === out.number &&
          r.data.revision === out.revision,
      )
    )
      throw Error(
        "Drawing number and revision already recorded; issue a new revision",
      );
    if (
      kind === "drawing" &&
      current(records, "drawing").some(
        (r) => r.data.number === out.number && r.data.entityId !== out.entityId,
      )
    )
      throw Error("Revise the existing drawing number");
    if (kind === "programme") {
      const progress = Number(out.progress);
      if (!Number.isFinite(progress) || progress < 0 || progress > 100)
        throw Error("Progress must be 0–100");
      out.progress = progress;
      if (
        out.baselineEnd < out.baselineStart ||
        out.plannedEnd < out.plannedStart ||
        (out.actualEnd && (!out.actualStart || out.actualEnd < out.actualStart))
      )
        throw Error("Task dates are out of sequence");
      if (
        out.actualStart > new Date().toISOString().slice(0, 10) ||
        out.actualEnd > new Date().toISOString().slice(0, 10)
      )
        throw Error("Actual dates cannot be in the future");
      if (progress === 100 && !out.actualEnd)
        throw Error("Completed task requires actual finish");
      if (out.dependsOn) {
        const dependency = ref(out.dependsOn, ["programme"]);
        if (dependency.data.entityId === out.entityId)
          throw Error("Task cannot depend on itself");
        if (out.plannedStart < dependency.data.plannedEnd)
          throw Error("Task starts before predecessor finishes");
        if (progress > 0 && dependency.data.progress !== 100)
          throw Error("Predecessor must be complete before progress");
        let parent: RecordItem | undefined = dependency;
        const visited = new Set([out.entityId]);
        while (parent) {
          if (visited.has(parent.data.entityId))
            throw Error("Programme dependency cycle");
          visited.add(parent.data.entityId);
          parent = records.find((r) => r.id === parent!.data.dependsOn);
        }
      }
    }
    if (kind === "diary" && out.date > new Date().toISOString().slice(0, 10))
      throw Error("Diary cannot be future dated");
    return append(out);
  }
  if (kind === "engineeringReview") {
    requireRole(u, ["engineer"]);
    attest(d);
    const mandate = liveMandate(records, u.id);
    if (!mandate)
      throw Error(
        "Forbidden: active project engineering authorisation required",
      );
    if (d.packageKey !== engineeringKey(records))
      throw Error(
        "Engineering package changed; refresh and review current revisions",
      );
    const bundle = engineeringKinds.flatMap((k) => current(records, k));
    if (!bundle.length || bundle.some((r) => r.author === u.id))
      throw Error(
        "Forbidden: independent engineer must review the complete package",
      );
    const decision = choice(
      d.decision,
      ["accepted", "rejected", "information-required"],
      "Engineering decision",
    );
    if (decision === "accepted") {
      ensureEmpty(
        engineeringBlockers(records).filter(
          (e) => !e.startsWith("Current package"),
        ),
      );
      const questions = bundle.filter((r) => ["query", "rfi"].includes(r.kind));
      if (
        !Array.isArray(d.responses) ||
        d.responses.length !== questions.length ||
        questions.some(
          (q) =>
            !d.responses.some(
              (r: any) =>
                r.queryId === q.id &&
                typeof r.response === "string" &&
                r.response.trim(),
            ),
        )
      )
        throw Error(
          "A recorded response is required for every structural query and RFI",
        );
    }
    const responses = Array.isArray(d.responses)
      ? d.responses.map((r: any) => ({
          queryId: ref(r.queryId, ["query", "rfi"]).id,
          response: text(r.response, "Engineer response"),
        }))
      : [];
    return append({
      packageKey: engineeringKey(records),
      dependencies: bundle.map((r) => r.id),
      mandateId: mandate.id,
      decision,
      responses,
      note: text(d.note, "Engineer review rationale"),
      source: text(d.source, "Signed engineering evidence reference"),
      attest: true,
      scope: mandate.data.scope,
      statement:
        "Recorded human review only. Software does not certify structural safety.",
    });
  }
  if (kind === "gateReview") {
    requireRole(u, ["manager", "supervisor"]);
    attest(d);
    const target = ref(d.targetId, [
      "control",
      "holdpoint",
      "snag",
      "handoverItem",
    ]);
    if (target.author === u.id)
      throw Error("Forbidden: independent reviewer required");
    if (target.kind === "handoverItem") requireRole(u, ["manager"]);
    if (
      target.data.validUntil &&
      Date.parse(target.data.validUntil) < Date.now()
    )
      throw Error("Control has expired");
    if (
      target.kind === "snag" &&
      (!target.data.remedy || !target.data.evidence)
    )
      throw Error("Record remedy and evidence before reinspection");
    return append({
      targetId: target.id,
      decision: choice(
        d.decision,
        ["accepted", "failed", "information-required"],
        "Inspection decision",
      ),
      note: text(d.note, "Inspection findings"),
      source: text(d.source, "Inspection evidence reference"),
      competence: text(d.competence, "Reviewer competence reference"),
      attest: true,
    });
  }
  if (kind === "workRelease") {
    requireRole(u, ["manager", "supervisor"]);
    attest(d);
    const stage = choice(
      d.stage,
      ["prestart", "installation", "final"],
      "Work stage",
    );
    if (d.packageKey !== releaseKey(records, stage))
      throw Error("Gate evidence changed; refresh before release");
    ensureEmpty(constructionBlockers(records, stage));
    const order = ["prestart", "installation", "final"],
      index = order.indexOf(stage);
    for (const prev of order.slice(0, index))
      if (!recordedStageRelease(records, prev))
        throw Error("Release preceding work stage first");
    return append({
      stage,
      packageKey: releaseKey(records, stage),
      engineeringKey: engineeringKey(records),
      planKey: current(records, "workplan")
        .map((r) => r.id)
        .join("|"),
      dependencies: records
        .filter((r) => !["handoverAcceptance", "workRelease"].includes(r.kind))
        .map((r) => r.id),
      note: text(d.note, "Release scope and limitations"),
      attest: true,
      statement:
        "Human permission for the stated work stage; not a structural certification.",
    });
  }
  if (kind === "permitClose") {
    requireRole(u, ["manager", "supervisor"]);
    attest(d);
    const target = ref(d.targetId, ["control"]);
    if (target.data.category !== "hot-work")
      throw Error("Hot work permit required");
    if (target.author === u.id)
      throw Error("Forbidden: independent fire watch closeout required");
    if (
      !records.some(
        (r) =>
          r.kind === "workRelease" && r.data.dependencies.includes(target.id),
      )
    )
      throw Error("Permit has not been used in a work release");
    const completedAt = time(d.completedAt, "Fire watch completion");
    if (Date.parse(completedAt) > Date.now())
      throw Error("Fire watch completion cannot be in the future");
    return append({
      targetId: target.id,
      completedAt,
      note: text(d.note, "Fire watch findings"),
      source: text(d.source, "Fire watch evidence reference"),
      attest: true,
    });
  }
  if (kind === "handoverAcceptance") {
    requireRole(u, ["manager"]);
    attest(d);
    if (d.packageKey !== handoverKey(records))
      throw Error("Handover dossier changed; refresh and review");
    ensureEmpty(closeoutBlockers(records));
    if (current(records, "handoverItem").some((r) => r.author === u.id))
      throw Error(
        "Forbidden: handover acceptance requires independent manager",
      );
    const clientAcceptedAt = date(d.clientAcceptedAt, "Client acceptance date");
    if (clientAcceptedAt > new Date().toISOString().slice(0, 10))
      throw Error("Client acceptance cannot be future dated");
    return append({
      packageKey: handoverKey(records),
      digest: createHash("sha256")
        .update(JSON.stringify(records))
        .digest("hex"),
      dependencies: records.map((r) => r.id),
      note: text(d.note, "Handover review findings"),
      clientName: text(d.clientName, "Client representative"),
      clientEvidence: text(
        d.clientEvidence,
        "Signed client acceptance reference",
      ),
      clientAcceptedAt,
      attest: true,
      statement:
        "Manager records externally evidenced client acceptance; no automated certification.",
    });
  }
}
