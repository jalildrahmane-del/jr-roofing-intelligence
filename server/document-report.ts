import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
import type { RecordItem } from "../src/model.ts";
export function documentReport(
  doc: RecordItem,
  status: string,
  records: RecordItem[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
        size: "A4",
        margin: 48,
        info: { Title: doc.data.title, Author: "JR Roofing Intelligence" },
      }),
      chunks: Buffer[] = [];
    pdf.on("data", (c) => chunks.push(c));
    pdf.on("error", reject);
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.font(
      fileURLToPath(new URL("./assets/DejaVuSans.ttf", import.meta.url)),
    );
    const text = (s: string) => {
      pdf.fontSize(10).text(s, { lineGap: 3 }).moveDown();
    };
    pdf.fontSize(19).text("Controlled document review").moveDown();
    text(
      `${doc.data.number} | Revision ${doc.data.revision} | ${doc.data.title}`,
    );
    text(
      `Status at export: ${status}\nExported: ${new Date().toISOString()}\nRecord: ${doc.id}`,
    );
    text(
      "Document use review only. Not structural safety certification or work release. Check the live register before use. AI generation disabled.",
    );
    text("MANUAL CONTENT\n" + doc.data.content);
    text("LIMITATIONS\n" + doc.data.limitations);
    text(
      "SUGGESTIONS — NOT VERIFIED FACTS\n" + (doc.data.suggestions || "None"),
    );
    text("SOURCE-LINKED CLAIMS");
    for (const c of doc.data.claims)
      text(`${c.text}\nSource: ${c.sourceId}\nLocator: ${c.locator}`);
    text("SOURCE RECORDS\n" + (doc.data.sourceIds.join("\n") || "None"));
    text(
      "ATTACHMENT\n" +
        (doc.data.fileName || "None") +
        "\nSHA256: " +
        (doc.data.sha256 || "None"),
    );
    text("AUDITABLE REVIEW HISTORY");
    for (const r of records.filter(
      (r) =>
        r.data.documentId === doc.id &&
        ["documentSubmit", "documentReview"].includes(r.kind),
    ))
      text(
        `${r.createdAt} | ${r.data.actor.name} (${r.data.actor.role}) | ${r.data.decision || "Submitted"}\n${r.data.note}\n${r.data.source || ""}\nRecord: ${r.id}`,
      );
    pdf.end();
  });
}
