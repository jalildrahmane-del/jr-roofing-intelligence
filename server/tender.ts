import { randomUUID, createHash } from "node:crypto";
import { imageSize } from "image-size";
import {
  current,
  optional,
  choice,
  decimal,
  date,
  observedDate,
  money,
  calculate,
  units,
} from "../src/tender.ts";
import { text, positive } from "../src/model.ts";
import type { User, RecordItem } from "../src/model.ts";
import type { Store } from "./store.ts";
const editable = ["manager", "supervisor", "engineer"];
export function digest(x: unknown) {
  return createHash("sha256").update(JSON.stringify(x)).digest("hex");
}
function object(d: any) {
  if (!d || typeof d !== "object" || Array.isArray(d))
    throw Error("Record data required");
}
export function latest(store: Store, user: User, pid: string, kind: string) {
  return current(
    store.snapshot(user).records.filter((r) => r.pid === pid),
    kind,
  );
}
function ref(records: RecordItem[], value: unknown, label: string) {
  const id = text(value, label, 100);
  const r = records.find((r) => r.data.entityId === id);
  if (!r) throw Error(`${label} not found in this project`);
  return r;
}
function sourceUrl(v: unknown) {
  const s = optional(v, 1000);
  if (s) {
    const u = new URL(s);
    if (u.protocol !== "https:" || u.username || u.password)
      throw Error("Source URL must be HTTPS without credentials");
  }
  return s;
}
function revision(store: Store, user: User, pid: string, kind: string, d: any) {
  const previousId = optional(d.previousId, 100);
  let entityId = randomUUID(),
    version = 1;
  if (previousId) {
    const previous = latest(store, user, pid, kind).find(
      (r) => r.id === previousId,
    );
    if (!previous)
      throw Error("Record has changed. Reload before revising it.");
    entityId = previous.data.entityId;
    version = previous.data.version + 1;
  }
  return { entityId, version, previousId };
}
function snapshot(store: Store, user: User, pid: string) {
  const state = store.snapshot(user),
    project = state.projects.find((p) => p.id === pid);
  if (!project) throw Error("Project not found");
  const records = state.records.filter((r) => r.pid === pid);
  return {
    project,
    roofs: current(records, "roof"),
    defects: current(records, "defect"),
    photos: current(records, "photo"),
    materials: current(records, "material"),
    estimates: current(records, "estimate"),
  };
}
export function saveTender(
  store: Store,
  user: User,
  pid: string,
  kind: string,
  d: any,
) {
  object(d);
  if (!editable.includes(user.role))
    throw Error("Forbidden: survey author role required");
  const roofs = latest(store, user, pid, "roof"),
    materials = latest(store, user, pid, "material");
  if (kind === "roof") {
    const data = {
      ...revision(store, user, pid, kind, d),
      name: text(d.name, "Roof name", 200),
      area: positive(d.area, "Roof area"),
      pitch: decimal(d.pitch, "Pitch", 90),
      covering: text(d.covering, "Roof covering", 200),
      structure: text(d.structure, "Structure / unknown", 500),
      installed: optional(d.installed, 100),
      surveyDate: observedDate(d.surveyDate, "Survey date"),
      surveyor: text(d.surveyor, "Surveyor", 200),
      access: text(d.access, "Access and restrictions", 1000),
      condition: choice(
        d.condition,
        ["Not assessed", "Good", "Fair", "Poor", "Critical"],
        "condition",
      ),
      leaks: choice(d.leaks, ["Unknown", "Yes", "No"], "leaks"),
      insulation: optional(d.insulation, 1000),
      drainage: text(d.drainage, "Drainage observations", 1000),
      observations: text(d.observations, "Observations", 10000),
      limitations: text(
        d.limitations,
        "Limitations and technical assumptions",
        10000,
      ),
    };
    if (data.area > 10000000) throw Error("Roof area exceeds supported range");
    return store.append(user, pid, kind, data);
  }
  if (kind === "defect") {
    const roof = ref(roofs, d.roofId, "Roof");
    if (d.previousId) {
      const prior = latest(store, user, pid, "defect").find(
        (r) => r.id === d.previousId,
      );
      if (
        prior &&
        prior.data.roofId !== roof.data.entityId &&
        latest(store, user, pid, "photo").some(
          (p) => p.data.defectId === prior.data.entityId,
        )
      )
        throw Error(
          "A defect with linked photos must keep its roof; create a separate finding for another roof",
        );
    }
    return store.append(user, pid, kind, {
      ...revision(store, user, pid, kind, d),
      roofId: roof.data.entityId,
      category: text(d.category, "Category", 200),
      severity: choice(
        d.severity,
        ["Low", "Medium", "High", "Critical"],
        "severity",
      ),
      location: text(d.location, "Defect location", 500),
      quantity: decimal(d.quantity, "Affected quantity", 10000000),
      unit: choice(d.unit, units, "unit"),
      description: text(d.description, "Evidence description", 10000),
      action: text(d.action, "Recommended action / investigation", 10000),
      assumptions: text(
        d.assumptions,
        "Technical assumptions / limitations",
        5000,
      ),
    });
  }
  if (kind === "photo") {
    const roof = ref(roofs, d.roofId, "Roof"),
      defectId = optional(d.defectId, 100);
    if (defectId) {
      const defect = ref(
        latest(store, user, pid, "defect"),
        defectId,
        "Defect",
      );
      if (defect.data.roofId !== roof.data.entityId)
        throw Error("Photo and defect roofs must match");
    }
    const rev = revision(store, user, pid, kind, d);
    let assetId = "",
      sha256 = "",
      width = 0,
      height = 0;
    if (rev.previousId) {
      const previous = latest(store, user, pid, kind).find(
        (r) => r.id === rev.previousId,
      )!;
      ({ assetId, sha256, width, height } = previous.data);
      if (d.image)
        throw Error(
          "Add replacement images as new evidence; original images are preserved",
        );
    } else {
      if (typeof d.image !== "string" || d.image.length > 1500000)
        throw Error("Photo must be JPEG/PNG, maximum 1 MiB");
      const match =
        /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(d.image);
      if (!match) throw Error("Invalid image data");
      const bytes = Buffer.from(match[2], "base64");
      if (bytes.length > 1024 * 1024 || bytes.toString("base64") !== match[2])
        throw Error("Invalid image size/encoding");
      const size = imageSize(bytes);
      if (
        size.type !== match[1].replace("jpeg", "jpg") ||
        !size.width ||
        !size.height ||
        size.width > 2000 ||
        size.height > 2000
      )
        throw Error(
          "Image must be JPEG/PNG and no larger than 2000 pixels per side",
        );
      width = size.width;
      height = size.height;
      sha256 = createHash("sha256").update(bytes).digest("hex");
      assetId = randomUUID();
      store.db
        .prepare(
          "INSERT INTO evidence(id,pid,mime,bytes,sha256) VALUES(?,?,?,?,?)",
        )
        .run(assetId, pid, "image/" + match[1], bytes, sha256);
    }
    let gps: any = rev.previousId
      ? latest(store, user, pid, kind).find((r) => r.id === rev.previousId)!
          .data.gps
      : null;
    if (d.gps) {
      object(d.gps);
      const lat = Number(d.gps.lat),
        lng = Number(d.gps.lng);
      if (
        !["number", "string"].includes(typeof d.gps.lat) ||
        !["number", "string"].includes(typeof d.gps.lng) ||
        String(d.gps.lat).trim() === "" ||
        String(d.gps.lng).trim() === "" ||
        !Number.isFinite(lat) ||
        Math.abs(lat) > 90 ||
        !Number.isFinite(lng) ||
        Math.abs(lng) > 180
      )
        throw Error("Invalid GPS coordinates");
      gps = {
        lat,
        lng,
        accuracy: positive(d.gps.accuracy, "GPS accuracy"),
        observedAt: text(d.gps.observedAt, "GPS capture time", 100),
        provenance:
          "Browser-reported point location; not independent proof of photo location",
      };
      if (
        Number.isNaN(Date.parse(gps.observedAt)) ||
        Math.abs(Date.now() - Date.parse(gps.observedAt)) > 86400000
      )
        throw Error("GPS capture must be within the last 24 hours");
    }
    if (!Array.isArray(d.annotations) || d.annotations.length > 30)
      throw Error("Maximum 30 annotations");
    const annotations = d.annotations.map((a: any) => {
      object(a);
      const x = positive(a.x, "Box x", true),
        y = positive(a.y, "Box y", true),
        w = positive(a.w, "Box width"),
        h = positive(a.h, "Box height");
      if (x + w > 1.000001 || y + h > 1.000001)
        throw Error("Annotation must be inside photo");
      return { x, y, w, h, label: text(a.label, "Annotation label", 200) };
    });
    return store.append(user, pid, kind, {
      ...rev,
      roofId: roof.data.entityId,
      defectId,
      assetId,
      sha256,
      width,
      height,
      gps,
      takenAt: observedDate(d.takenAt, "Photo date"),
      dateProvenance: "User-entered photograph date",
      caption: text(d.caption, "Photo caption", 2000),
      annotations,
    });
  }
  if (kind === "material") {
    const rate = money(d.rate, "Budget unit rate"),
      rateSource = optional(d.rateSource, 500),
      rateDate = observedDate(d.rateDate, "Rate date", true);
    if (rate !== null && (!rateSource || !rateDate))
      throw Error("Material rate requires source and date");
    const sourceDate = observedDate(d.sourceDate, "Source date"),
      validUntil = date(d.validUntil, "Source review due date", true);
    if (validUntil && validUntil < sourceDate)
      throw Error("Source review date cannot precede source date");
    return store.append(user, pid, kind, {
      ...revision(store, user, pid, kind, d),
      name: text(d.name, "Product / material", 300),
      manufacturer: text(d.manufacturer, "Manufacturer / generic", 300),
      category: text(d.category, "Category", 200),
      unit: choice(d.unit, units, "unit"),
      sourceUrl: sourceUrl(d.sourceUrl),
      sourceReference: text(d.sourceReference, "Source reference", 1000),
      sourceRevision: text(d.sourceRevision, "Source revision / edition", 200),
      sourceDate,
      validUntil,
      properties: text(d.properties, "Specification and limitations", 10000),
      rate: rate === null ? "" : (rate / 100).toFixed(2),
      rateSource,
      rateDate,
      sourceStatus: "Source recorded; technical suitability not certified",
    });
  }
  if (kind === "estimate") {
    const pricing = calculate(
      d.lines,
      d.contingency,
      d.margin,
      d.vat,
      roofs,
      materials,
    );
    return store.append(user, pid, kind, {
      ...revision(store, user, pid, kind, d),
      title: text(d.title, "Option title", 300),
      scope: text(d.scope, "Scope", 10000),
      exclusions: text(d.exclusions, "Exclusions", 10000),
      assumptions: text(
        d.assumptions,
        "Pricing and technical assumptions",
        10000,
      ),
      paymentTerms: text(d.paymentTerms, "Commercial terms", 5000),
      validUntil: date(d.validUntil, "Quotation valid until"),
      pricing,
    });
  }
  if (kind === "document") {
    const type = choice(d.type, ["survey", "quotation"], "document type"),
      snap = snapshot(store, user, pid);
    if (!snap.roofs.length) throw Error("Record a roof survey first");
    const estimateId =
      type === "quotation"
        ? ref(snap.estimates, d.estimateId, "Estimate").data.entityId
        : "";
    return store.append(user, pid, kind, {
      type,
      title: text(d.title, "Document title", 300),
      estimateId,
      snapshot: snap,
      fingerprint: digest(snap),
      status: "Draft for review",
    });
  }
  if (kind === "approval") {
    if (user.role !== "manager")
      throw Error("Forbidden: manager approval required");
    const doc = store
      .snapshot(user)
      .records.find(
        (r) => r.id === d.documentId && r.pid === pid && r.kind === "document",
      );
    if (!doc) throw Error("Document not found");
    if (doc.author === user.id)
      throw Error("An independent manager must approve this document");
    if (d.attest !== true)
      throw Error("Confirm you reviewed the complete PDF and limitations");
    if (
      store
        .snapshot(user)
        .records.some(
          (r) => r.kind === "approval" && r.data.documentId === doc.id,
        )
    )
      throw Error("Document already approved");
    if (digest(snapshot(store, user, pid)) !== doc.data.fingerprint)
      throw Error(
        "Project evidence changed. Generate a new draft before approval",
      );
    const snap = doc.data.snapshot;
    const estimates =
      doc.data.type === "quotation"
        ? snap.estimates.filter(
            (r: RecordItem) => r.data.entityId === doc.data.estimateId,
          )
        : [];
    for (const e of estimates) {
      if (!e.data.pricing.complete)
        throw Error("Cannot approve an unpriced quotation");
      if (e.data.validUntil < new Date().toISOString().slice(0, 10))
        throw Error("Quotation validity has expired");
      for (const l of e.data.pricing.lines) {
        const roof = snap.roofs.find(
            (r: RecordItem) => r.data.entityId === l.roofId,
          ),
          mat = snap.materials.find(
            (r: RecordItem) => r.data.entityId === l.materialId,
          );
        if (
          (roof && roof.id !== l.roofRevision) ||
          (mat && mat.id !== l.materialRevision)
        )
          throw Error("Takeoff or material changed; revise the estimate");
        if (
          mat?.data.validUntil &&
          mat.data.validUntil < new Date().toISOString().slice(0, 10)
        )
          throw Error("Material source review is overdue");
      }
    }
    return store.append(user, pid, kind, {
      documentId: doc.id,
      fingerprint: doc.data.fingerprint,
      reviewer: user.name,
      reviewerId: user.id,
      note: text(d.note, "Review note", 5000),
      status:
        "Approved for issue - document review only; not engineering certification",
    });
  }
  throw Error("Unknown record type");
}
