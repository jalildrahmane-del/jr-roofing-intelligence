import { createHash, randomUUID } from "node:crypto";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
import { text } from "../src/model.ts";
import type { Store } from "./store.ts";
import type { User, RecordItem } from "../src/model.ts";
import { SAFETY_DRAFT_LIMIT } from "../src/risk-authoring.ts";
import { DOCUMENT_CHECKLIST_VERSION, documentReviewItems, reviewChecklistComplete, validateDocumentChecklist } from "../src/document-review.ts";
const digest = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
function access(store: Store, user: User, pid: string) {
  if (!["manager", "supervisor", "engineer", "viewer"].includes(user.role))
    throw Error("Forbidden: document staff access required");
  store.requireProject(user,pid);
  const state = store.snapshot(user);
  if (!state.projects.some((p) => p.id === pid))
    throw Error("Project not found");
  return state.records.filter((r) => r.pid === pid);
}
function currentSource(records: RecordItem[], source: RecordItem) {
  const entity = source.data.entityId;
  return (
    !entity ||
    records
      .filter((r) => r.kind === source.kind && r.data.entityId === entity)
      .at(-1)?.id === source.id
  );
}
export function documentStatus(records: RecordItem[], doc: RecordItem) {
  if (
    records
      .filter(
        (r) =>
          r.kind === "intelligence.draft" &&
          r.data.entityId === doc.data.entityId,
      )
      .at(-1)?.id !== doc.id
  )
    return "Superseded";
  if (
    doc.data.sources.some((s: any) => {
      const source = records.find((r) => r.id === s.recordId);
      return (
        !source || !currentSource(records, source) || digest(source) !== s.hash
      );
    })
  )
    return "Stale — source changed; new draft required";
  const review = records
    .filter(
      (r) => r.kind === "intelligence.review" && r.data.documentId === doc.id,
    )
    .at(-1);
  return review?.data.decision === "accepted"
    ? (review.data.fingerprint === digest(doc) && reviewChecklistComplete(doc.data.type,review.data.checklistVersion,review.data.checks)
      ? "Reviewed for issue — not engineering certification"
      : "Historical review — structured checklist required")
    : review?.data.decision === "rejected"
      ? "Rejected — revise draft"
      : "Draft — independent review required";
}
export function documentState(store: Store, user: User, pid: string) {
  const records = access(store, user, pid);
  return {
    records: records.filter((r) => r.kind.startsWith("intelligence.")),
    sources: records.filter(
      (r) =>
        !["intelligence.draft", "intelligence.review", "approval"].includes(
          r.kind,
        ),
    ).map(r=>({...r,current:currentSource(records,r)})),
    documents: records
      .filter((r) => r.kind === "intelligence.draft")
      .map((r) => ({ ...r, status: documentStatus(records, r),
        canReview: user.role === "manager" && r.author !== user.id && currentSource(records,r) && !documentStatus(records,r).startsWith("Stale"),
        reviewItems: documentReviewItems(r.data.type),
        reviewHistory: records.filter(review=>review.kind==="intelligence.review" && review.data.documentId===r.id).map(review=>({...review,reviewerName:store.db.prepare("SELECT name FROM users WHERE id=?").get(review.author)?.name||review.author})),
      })),
    canReview: user.role === "manager",
    checklistVersion: DOCUMENT_CHECKLIST_VERSION,
    canWrite: store.projectPermission(user,pid) === "edit",
    ai: {
      enabled: false,
      reason:
        "Paid AI generation has not been approved. No provider is called.",
    },
  };
}
export function documentCommand(
  store: Store,
  user: User,
  pid: string,
  action: string,
  d: any,
) {
  if (!d || typeof d !== "object" || Array.isArray(d))
    throw Error("Document data required");
  return store.transaction(() => {
    store.requireProject(user,pid,true);
    const records = access(store, user, pid);
    if (action === "generate")
      throw Error(
        "AI generation disabled: owner approval and server configuration required; no provider called",
      );
    const revision = (kind: string) => {
      if (!d.replaces)
        return { entityId: randomUUID(), version: 1, replaces: null };
      const old = records.find((r) => r.kind === kind && r.id === d.replaces);
      if (!old || !currentSource(records, old))
        throw Error("Current revision required");
      return {
        entityId: old.data.entityId,
        version: old.data.version + 1,
        replaces: old.id,
      };
    };
    if (action === "source")
      return store.append(user, pid, "intelligence.source", {
        ...revision("intelligence.source"),
        title: text(d.title, "Source title", 300),
        reference: text(d.reference, "Document/drawing reference", 1000),
        content: text(d.content, "Source text", 30000),
        classification:
          "User-supplied source; authenticity requires human verification",
      });
    if (action === "draft") {
      if (!["RAMS", "CPP", "survey", "specification"].includes(d.type))
        throw Error("Unsupported document type");
      if (
        !Array.isArray(d.sources) ||
        !d.sources.length ||
        d.sources.length > 20
      )
        throw Error("1–20 source references required");
      const sources = d.sources.map((s: any) => {
        const source = records.find(
          (r) =>
            r.id === s?.recordId &&
            !["intelligence.draft", "intelligence.review", "approval"].includes(
              r.kind,
            ),
        );
        if (!source || !currentSource(records, source))
          throw Error("Current project source required");
        const excerpt = text(s.excerpt, "Exact source excerpt", 10000);
        const sourceText =
          source.kind === "intelligence.source"
            ? source.data.content
            : JSON.stringify(source.data);
        if (!sourceText.includes(excerpt))
          throw Error("Excerpt must occur in the source");
        return {
          recordId: source.id,
          hash: digest(source),
          excerpt,
          reference: source.data.reference || source.id,
          snapshot: source,
        };
      });
      return store.append(user, pid, "intelligence.draft", {
        ...revision("intelligence.draft"),
        type: d.type,
        title: text(d.title, "Title", 300),
        sources,
        sourceStatements: sources.map((s: any) => ({
          text: s.excerpt,
          sourceId: s.recordId,
        })),
        proposals: text(
          d.proposals,
          "Proposed method / content for review",
          SAFETY_DRAFT_LIMIT,
        ),
        limitations: text(d.limitations, "Gaps and limitations", 10000),
        origin: "Human-authored draft; not AI generated",
        factNotice:
          "Source excerpts are traceable statements, not independently verified site facts",
      });
    }
    if (action === "review") {
      if (user.role !== "manager")
        throw Error("Forbidden: independent manager review required");
      const doc = records.find(
        (r) => r.id === d.documentId && r.kind === "intelligence.draft",
      );
      if (!doc) throw Error("Document not found");
      if (doc.author === user.id)
        throw Error("Forbidden: author cannot review own document");
      if (!["accepted", "rejected"].includes(d.decision) || d.attest !== true)
        throw Error("Explicit review decision and attestation required");
      if (
        documentStatus(records, doc).startsWith("Stale") ||
        documentStatus(records, doc) === "Superseded"
      )
        throw Error("Source or document superseded; generate a new draft");
      const latestReview=records.filter(r=>r.kind==="intelligence.review" && r.data.documentId===doc.id).at(-1);
      if ((d.previousReviewId ?? null) !== (latestReview?.id ?? null)) throw Error("Document review changed; refresh before recording a new decision");
      const checklist=validateDocumentChecklist(doc.data.type,d.decision,d.checklistVersion,d.checks);
      return store.append(user, pid, "intelligence.review", {
        ...checklist,
        documentId: doc.id,
        previousReviewId: latestReview?.id ?? null,
        decision: d.decision,
        note: text(d.note, "Review note", 5000),
        fingerprint: digest(doc),
        scope:
          "Document review only; independent engineering approvals remain separate",
      });
    }
    throw Error("Unknown document action");
  });
}
export async function documentPdf(
  store: Store,
  user: User,
  pid: string,
  id: string,
) {
  const records = access(store, user, pid),
    doc = records.find((r) => r.id === id && r.kind === "intelligence.draft");
  if (!doc) throw Error("Document not found");
  const pdf = new PDFDocument({ size: "A4", margin: 48 }),
    chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    pdf.on("data", (c) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });
  pdf.registerFont("Body",fileURLToPath(new URL("./assets/DejaVuSans.ttf",import.meta.url)));
  pdf.registerFont("Bold",fileURLToPath(new URL("./assets/DejaVuSans-Bold.ttf",import.meta.url)));
  pdf
    .font("Bold")
    .fontSize(18)
    .text("JR ROOFING INTELLIGENCE")
    .moveDown()
    .text(doc.data.title);
  pdf
    .font("Body")
    .fontSize(10)
    .text(`${doc.data.type} / revision ${doc.data.version}`)
    .text(documentStatus(records, doc))
    .text(doc.data.origin)
    .moveDown()
    .text(
      "TRACEABLE SOURCE EXCERPTS — authenticity and site applicability require verification",
    );
  for (const s of doc.data.sources)
    pdf
      .moveDown()
      .text(`${s.reference} / record ${s.recordId}`)
      .text(s.excerpt)
      .text(`SHA-256 ${s.hash}`);
  pdf
    .moveDown()
    .font("Bold")
    .fontSize(14)
    .text("Proposed content — human review required")
    .font("Body")
    .fontSize(10)
    .text(doc.data.proposals)
    .moveDown()
    .font("Bold")
    .fontSize(14)
    .text("Gaps and limitations")
    .font("Body")
    .fontSize(10)
    .text(doc.data.limitations)
    .moveDown()
    .text("Not a structural safety certificate or authority to commence work.");
  const reviews=records.filter(r=>r.kind==="intelligence.review" && r.data.documentId===doc.id);
  const review=reviews.at(-1);
  pdf.moveDown().font("Bold").fontSize(14).text("Independent document review").font("Body").fontSize(10);
  if (review) {
    const reviewer=store.db.prepare("SELECT name FROM users WHERE id=?").get(review.author)?.name||review.author;
    pdf.text(`Reviewer: ${reviewer}`).text(`Recorded: ${review.createdAt}`).text(`Decision: ${review.data.decision}`).text(`Document fingerprint: ${review.data.fingerprint}`).text(`Review note: ${review.data.note}`);
    if (review.data.checklistVersion && Array.isArray(review.data.checklistItems)) {
      pdf.text(`Checklist version: ${review.data.checklistVersion}`);
      for (const item of review.data.checklistItems) pdf.text(`${item.confirmed?"Confirmed":"Not confirmed"}: ${item.label}`);
    } else pdf.text("Historical review: no structured checklist was recorded. A new checklist review is required.");
    pdf.text("Status shown above is recalculated from current document and source revisions.");
  } else pdf.text("No independent document review recorded.");
  pdf.end();
  return done;
}
