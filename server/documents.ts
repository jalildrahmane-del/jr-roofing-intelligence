import { randomUUID, createHash } from "node:crypto";
import { TextDecoder } from "node:util";
import { Store } from "./store.ts";
import { text } from "../src/model.ts";
import type { User, RecordItem } from "../src/model.ts";
import { current, choice, optional } from "../src/tender.ts";
export const documentCategories = [
  "Survey narrative",
  "Specification",
  "RAMS",
  "CPP",
  "Design",
  "QA",
  "O&M",
  "Other",
];
const sourceKinds = [
  "controlledDocument",
  "roof",
  "defect",
  "photo",
  "material",
  "drawing",
  "loadcase",
  "query",
  "rfi",
  "load",
  "control",
  "holdpoint",
  "handoverItem",
  "diary",
];
export function documentState(
  store: Store,
  records: RecordItem[],
  doc: RecordItem,
  visited = new Set<string>(),
): { status: string; canSubmit: boolean; canReview: boolean } {
  const result = (status: string, canSubmit = false, canReview = false) => ({
    status,
    canSubmit,
    canReview,
  });
  if (!current(records, "controlledDocument").some((r) => r.id === doc.id))
    return result("Superseded");
  if (visited.has(doc.id)) return result("Invalid source cycle");
  visited = new Set(visited).add(doc.id);
  for (const id of doc.data.sourceIds) {
    const source = records.find((r) => r.id === id);
    if (
      !source ||
      !current(records, source.kind).some((r) => r.id === source.id)
    )
      return result("Stale sources");
    if (
      source.kind === "controlledDocument" &&
      documentState(store, records, source, visited).status !==
        "Approved for document use"
    )
      return result("Source document not currently approved");
  }
  const review = records
    .filter((r) => r.kind === "documentReview" && r.data.documentId === doc.id)
    .at(-1);
  if (review) {
    if (review.data.decision === "approved") {
      const reviewer = store.db
        .prepare("SELECT id,name,role,company FROM users WHERE id=?")
        .get(review.author) as User | undefined;
      if (
        !reviewer ||
        reviewer.role !== "manager" ||
        !store.canWrite(reviewer, doc.pid)
      )
        return result("Reviewer authority revoked");
      return result("Approved for document use", false, true);
    }
    return result(
      review.data.decision === "withdrawn"
        ? "Approval withdrawn"
        : "Changes requested",
    );
  }
  if (
    records.some(
      (r) => r.kind === "documentSubmit" && r.data.documentId === doc.id,
    )
  )
    return result("Awaiting independent review", false, true);
  return result("Draft", true);
}
export function saveDocument(
  store: Store,
  u: User,
  pid: string,
  kind: string,
  d: any,
): RecordItem | undefined {
  if (
    !["controlledDocument", "documentSubmit", "documentReview"].includes(kind)
  )
    return;
  if (!store.canWrite(u, pid))
    throw Error("Forbidden: project write access required");
  const records = store.snapshot(u).records.filter((r) => r.pid === pid),
    append = (data: any) =>
      store.append(u, pid, kind, {
        ...data,
        actor: { id: u.id, name: u.name, role: u.role },
      });
  if (kind === "controlledDocument") {
    const prior = d.previousId
      ? current(records, kind).find((r) => r.id === d.previousId)
      : undefined;
    if (d.previousId && !prior)
      throw Error("Document changed; refresh before revising");
    const entityId = prior?.data.entityId || randomUUID(),
      number = text(d.number, "Document number", 100),
      revision = text(d.revision, "Revision", 50);
    if (prior && prior.data.number !== number)
      throw Error("Document number cannot change; create a new document");
    if (
      current(records, kind).some(
        (r) => r.data.number === number && r.data.entityId !== entityId,
      )
    )
      throw Error("Revise the existing document number");
    if (
      records.some(
        (r) =>
          r.kind === kind &&
          r.data.number === number &&
          r.data.revision === revision,
      )
    )
      throw Error("Document revision already exists");
    if (
      !Array.isArray(d.sourceIds) ||
      d.sourceIds.length > 100 ||
      new Set(d.sourceIds).size !== d.sourceIds.length
    )
      throw Error("Supply up to 100 unique source record IDs");
    for (const id of d.sourceIds) {
      const source = records.find(
        (r) => r.id === id && sourceKinds.includes(r.kind),
      );
      if (!source || !current(records, source.kind).some((r) => r.id === id))
        throw Error("Source missing, unauthorised or superseded");
      if (source.data.entityId === entityId)
        throw Error("A document cannot cite its own revision");
    }
    if (!Array.isArray(d.claims) || d.claims.length > 100)
      throw Error("Invalid factual claims");
    const claims = d.claims.map((c: any) => {
      if (!c || !d.sourceIds.includes(c.sourceId))
        throw Error("Every factual claim needs a selected source");
      return {
        text: text(c.text, "Claim text", 2000),
        sourceId: c.sourceId,
        locator: text(c.locator, "Source page or evidence locator", 200),
      };
    });
    let fileId = prior?.data.fileId || "",
      fileName = prior?.data.fileName || "",
      sha256 = prior?.data.sha256 || "";
    if (d.file) {
      const name = text(d.file.name, "Filename", 100);
      if (
        !/^[a-zA-Z0-9][a-zA-Z0-9._ -]*\.(pdf|txt)$/.test(name) ||
        name.includes("..")
      )
        throw Error("Use a plain .pdf or .txt filename without paths");
      const encoded = text(d.file.base64, "File data", 6000000);
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
        throw Error("Invalid file encoding");
      const bytes = Buffer.from(encoded, "base64");
      if (
        bytes.length > 4 * 1024 * 1024 ||
        bytes.toString("base64") !== encoded
      )
        throw Error("File must be canonical base64 and at most 4 MiB");
      const mime = name.endsWith(".pdf") ? "application/pdf" : "text/plain";
      if (mime === "application/pdf") {
        const raw = bytes.toString("latin1");
        if (
          !/^%PDF-1\.[0-7][\r\n]/.test(raw) ||
          !raw.trimEnd().endsWith("%%EOF") ||
          !raw.includes("startxref")
        )
          throw Error("Invalid or unsupported PDF");
        if (
          /\/(JavaScript|JS|OpenAction|AA|Launch|EmbeddedFiles|RichMedia|XFA|Encrypt)\b/i.test(
            raw,
          )
        )
          throw Error("Active or encrypted PDFs are not accepted");
      } else {
        let value: string;
        try {
          value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch {
          throw Error("Text file must be UTF-8");
        }
        if (value.includes("\0"))
          throw Error("Binary content is not a text document");
      }
      fileId = randomUUID();
      fileName = name;
      sha256 = createHash("sha256").update(bytes).digest("hex");
      store.db
        .prepare(
          "INSERT INTO document_files(id,pid,mime,bytes,sha256,name) VALUES(?,?,?,?,?,?)",
        )
        .run(fileId, pid, mime, bytes, sha256, name);
    }
    return append({
      entityId,
      number,
      revision,
      version: (prior?.data.version || 0) + 1,
      previousId: prior?.id || "",
      title: text(d.title, "Document title", 300),
      category: choice(d.category, documentCategories, "document category"),
      content: text(d.content, "Manual document content", 50000),
      limitations: text(d.limitations, "Limitations", 10000),
      suggestions: optional(d.suggestions, 10000),
      sourceIds: d.sourceIds,
      claims,
      fileId,
      fileName,
      sha256,
      origin: "Manual — AI disabled",
      status: "Draft",
    });
  }
  const doc = current(records, "controlledDocument").find(
    (r) => r.id === d.documentId,
  );
  if (!doc) throw Error("Current document revision not found");
  const state = documentState(store, records, doc);
  if (d.attest !== true)
    throw Error("Explicit human review attestation required");
  if (kind === "documentSubmit") {
    if (!state.canSubmit)
      throw Error("Document cannot be submitted: " + state.status);
    return append({
      documentId: doc.id,
      revision: doc.data.revision,
      sourceIds: doc.data.sourceIds,
      note: text(d.note, "Submission note", 5000),
      attest: true,
    });
  }
  if (u.role !== "manager")
    throw Error("Forbidden: independent manager required");
  let lineage: RecordItem | undefined = doc;
  while (lineage) {
    if (lineage.author === u.id)
      throw Error(
        "Forbidden: document contributors cannot approve their own work",
      );
    lineage = records.find((r) => r.id === lineage!.data.previousId);
  }
  if (
    records.some(
      (r) =>
        r.kind === "documentSubmit" &&
        r.data.documentId === doc.id &&
        r.author === u.id,
    )
  )
    throw Error("Forbidden: submitter cannot independently review");
  const decision = choice(
    d.decision,
    ["approved", "changes-requested", "withdrawn"],
    "Review decision",
  );
  if (
    !state.canReview ||
    (state.status === "Approved for document use" &&
      decision !== "withdrawn") ||
    (state.status !== "Approved for document use" && decision === "withdrawn")
  )
    throw Error("Review no longer applicable: " + state.status);
  if (d.revision !== doc.data.revision || d.versionId !== doc.id)
    throw Error("Review revision changed; refresh first");
  return append({
    documentId: doc.id,
    revision: doc.data.revision,
    versionId: doc.id,
    decision,
    note: text(d.note, "Review findings", 10000),
    source: text(d.source, "Review evidence reference", 1000),
    attest: true,
    statement:
      "Document use review only; not structural safety certification or work release.",
  });
}
