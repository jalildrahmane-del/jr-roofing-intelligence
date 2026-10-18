import { validatePng } from "./png.ts";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
import type { Store } from "./store.ts";
import type { RecordItem } from "../src/model.ts";
import { pounds } from "../src/tender.ts";

export function renderReport(
  store: Store,
  record: RecordItem,
  approval?: RecordItem,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
        size: "A4",
        margins: { top: 48, bottom: 55, left: 48, right: 48 },
        bufferPages: true,
        info: {
          Title: record.data.title,
          Author: "JR Roofing Intelligence",
          Subject:
            "Roof survey / commercial document - no engineering certification",
        },
      }),
      chunks: Buffer[] = [];
    pdf.on("data", (c) => chunks.push(c));
    pdf.on("error", reject);
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    try {
      pdf.registerFont(
        "Body",
        fileURLToPath(new URL("./assets/DejaVuSans.ttf", import.meta.url)),
      );
      pdf.registerFont(
        "Bold",
        fileURLToPath(new URL("./assets/DejaVuSans-Bold.ttf", import.meta.url)),
      );
      const width = pdf.page.width - 96,
        body = (t: unknown) =>
          String(t ?? "Not recorded").replace(/[\u2010-\u2015]/g, "-"),
        room = (height: number) => {
          if (pdf.y + height > pdf.page.height - 60) pdf.addPage();
        },
        heading = (t: string) => {
          pdf.x = 48;
          room(55);
          pdf
            .moveDown(0.6)
            .font("Bold")
            .fontSize(15)
            .fillColor("#303e5b")
            .text(body(t), { width });
          pdf.moveDown(0.45);
        },
        paragraph = (t: unknown) => {
          pdf.x = 48;
          pdf
            .font("Body")
            .fontSize(10)
            .fillColor("#303e5b")
            .text(body(t), { width, lineGap: 3 });
          pdf.moveDown(0.5);
        },
        row = (label: string, value: unknown) =>
          paragraph(label + ": " + body(value));
      pdf
        .font("Bold")
        .fontSize(11)
        .fillColor("#93701c")
        .text("JR ROOFING CONTRACTS");
      pdf
        .moveDown(0.8)
        .fontSize(25)
        .fillColor("#303e5b")
        .text(body(record.data.title), { width });
      pdf.moveDown(0.5);
      paragraph(
        approval
          ? "APPROVED FOR ISSUE - document review only"
          : "DRAFT FOR REVIEW - NOT APPROVED",
      );
      const s = record.data.snapshot;
      row("Project", s.project.name);
      row("Client", s.project.client);
      row("Site", s.project.address);
      row("Document reference", record.id);
      row("Snapshot created", record.createdAt);
      row("Evidence fingerprint", record.data.fingerprint);
      if (approval) {
        row("Reviewed by", approval.data.reviewer);
        row("Approval time", approval.createdAt);
        row("Review note", approval.data.note);
      }
      paragraph(
        "This document records a fixed evidence and pricing snapshot. Document approval does not certify structural adequacy, product suitability, statutory compliance, safe access or construction-stage loading. Independent technical and engineering approvals remain required.",
      );
      heading("1 / Roof survey and access limitations");
      for (const r of s.roofs) {
        heading(r.data.name + " - survey revision " + r.data.version);
        for (const [k, label] of Object.entries({
          area: "Measured area (m²)",
          pitch: "Pitch (degrees)",
          covering: "Covering",
          structure: "Structure",
          installed: "Installation year / information",
          surveyDate: "Survey date",
          surveyor: "Surveyor",
          access: "Access / restrictions",
          condition: "Condition",
          leaks: "Reported leaks",
          insulation: "Insulation observations",
          drainage: "Drainage",
          observations: "Survey observations",
          limitations: "Limitations / technical assumptions",
        }))
          row(label, r.data[k] || "Not recorded");
        if (
          !s.photos.some(
            (photo: RecordItem) => photo.data.roofId === r.data.entityId,
          )
        )
          paragraph("Evidence gap: no photograph is linked to this roof.");
      }
      heading("2 / Defect register");
      if (!s.defects.length)
        paragraph(
          "No defects recorded. This is not confirmation of a defect-free roof.",
        );
      for (const r of s.defects) {
        const d = r.data,
          roof = s.roofs.find((x: RecordItem) => x.data.entityId === d.roofId);
        heading(d.category + " - " + d.severity);
        row(
          "Roof / location",
          (roof?.data.name || "Unknown roof") + " / " + d.location,
        );
        row("Affected quantity", d.quantity + " " + d.unit);
        row("Observed evidence", d.description);
        row("Recommended action / investigation", d.action);
        row("Assumptions / limitations", d.assumptions);
        if (!s.photos.some((p: RecordItem) => p.data.defectId === d.entityId))
          paragraph("Evidence gap: no linked photograph for this defect.");
      }
      heading("3 / Photograph evidence and annotations");
      if (!s.photos.length)
        paragraph(
          "No photographs recorded. Survey evidence is incomplete; inspect the limitations above.",
        );
      for (const p of s.photos) {
        const d = p.data,
          asset = store.db
            .prepare("SELECT bytes,mime FROM evidence WHERE id=? AND pid=?")
            .get(d.assetId, record.pid) as any;
        if (!asset) throw Error("Report evidence image is unavailable");
        pdf.addPage();
        heading(d.caption);
        row(
          "Roof",
          s.roofs.find((r: RecordItem) => r.data.entityId === d.roofId)?.data
            .name,
        );
        row("Photo date / provenance", d.takenAt + " / " + d.dateProvenance);
        row("Server record timestamp", p.createdAt);
        if (d.gps)
          row(
            "Point GPS (browser reported)",
            `${d.gps.lat}, ${d.gps.lng}; accuracy ±${d.gps.accuracy}m; captured ${d.gps.observedAt}. ${d.gps.provenance}`,
          );
        else
          paragraph("GPS not captured; this photograph is not georeferenced.");
        room(300);
        const w = Math.min(width, 400),
          h = Math.min(290, (w * d.height) / d.width),
          iw = (h * d.width) / d.height,
          x = 48,
          y = pdf.y;
        if (asset.mime === "image/png") validatePng(Buffer.from(asset.bytes));
        pdf.image(Buffer.from(asset.bytes), x, y, { width: iw, height: h });
        for (const [index, a] of d.annotations.entries()) {
          pdf
            .save()
            .lineWidth(2)
            .strokeColor("#b24d14")
            .rect(x + a.x * iw, y + a.y * h, a.w * iw, a.h * h)
            .stroke();
          pdf
            .font("Bold")
            .fontSize(10)
            .fillColor("#b24d14")
            .text(String(index + 1), x + a.x * iw + 3, y + a.y * h + 3, {
              lineBreak: false,
            });
          pdf.restore();
        }
        pdf.y = y + h + 12;
        for (const [i, a] of d.annotations.entries())
          row(`Marked area ${i + 1}`, a.label);
        row("Image SHA-256", d.sha256);
      }
      heading("4 / Materials and source provenance");
      if (!s.materials.length)
        paragraph(
          "No manufacturer data recorded. Confirm product selection and technical suitability before tender issue.",
        );
      for (const m of s.materials) {
        const d = m.data;
        heading(d.name);
        row("Manufacturer / category", d.manufacturer + " / " + d.category);
        row(
          "Source reference / revision",
          d.sourceReference + " / " + d.sourceRevision,
        );
        if (d.sourceUrl) row("Source URL", d.sourceUrl);
        row(
          "Source date / review due",
          d.sourceDate + " / " + (d.validUntil || "Not set"),
        );
        row("Status", d.sourceStatus);
        row("Specification and limitations", d.properties);
      }
      if (s.estimates.length) pdf.addPage();
      heading("5 / Option comparison and commercial pricing");
      const estimates =
        record.data.type === "quotation"
          ? s.estimates.filter(
              (e: RecordItem) => e.data.entityId === record.data.estimateId,
            )
          : s.estimates;
      if (!estimates.length)
        paragraph(
          "No priced options included. This survey is not a quotation.",
        );
      for (const option of estimates) {
        room(80);
        row(
          option.data.title,
          `Net ${pounds(option.data.pricing.netPence)} | VAT ${pounds(option.data.pricing.vatPence)} | Total ${pounds(option.data.pricing.grossPence)}`,
        );
      }
      for (const [optionIndex, e] of estimates.entries()) {
        const d = e.data,
          p = d.pricing;
        if (optionIndex > 0) pdf.addPage();
        heading(d.title + " - option revision " + d.version);
        row("Scope", d.scope);
        row("Exclusions", d.exclusions);
        row("Technical / pricing assumptions", d.assumptions);
        row("Commercial terms", d.paymentTerms);
        row("Valid until", d.validUntil);
        for (const [i, l] of p.lines.entries()) {
          room(150);
          pdf
            .font("Bold")
            .fontSize(11)
            .text(`${i + 1}. ${body(l.description)} [${l.category}]`, {
              width,
            });
          row(
            "Roof scope",
            l.roofId
              ? s.roofs.find(
                  (roof: RecordItem) => roof.data.entityId === l.roofId,
                )?.data.name || "Unknown roof"
              : "Project-wide",
          );
          if (l.materialId)
            row(
              "Material source",
              s.materials.find(
                (material: RecordItem) =>
                  material.data.entityId === l.materialId,
              )?.data.name || "Unknown material",
            );
          row(
            "Takeoff",
            `${l.quantityMilli / 1000} ${l.unit}; basis ${l.basis}; base ${l.quantity}; waste ${l.waste}%`,
          );
          row(
            "Rate / line total",
            `${pounds(l.ratePence)} / ${pounds(l.extendedPence)}`,
          );
          row(
            "Rate source / date",
            (l.rateSource || "Not priced") +
              " / " +
              (l.rateDate || "Not recorded"),
          );
        }
        room(310);
        heading("Reconciled totals");
        for (const category of [
          "material",
          "labour",
          "plant",
          "scaffold",
          "prelims",
        ])
          row(
            category + " subtotal (priced lines only)",
            pounds(p.subtotals[category]),
          );
        row("Direct cost", pounds(p.directPence));
        row(`Contingency (${p.contingency}%)`, pounds(p.contingencyPence));
        row("Cost including contingency", pounds(p.costPence));
        row(`Profit at ${p.margin}% sales margin`, pounds(p.profitPence));
        row("Net quotation", pounds(p.netPence));
        row(`VAT (${p.vat}% entered by author)`, pounds(p.vatPence));
        row("Total including VAT", pounds(p.grossPence));
        if (!p.complete)
          paragraph(
            "UNPRICED / INCOMPLETE - missing rates are not zero. This option cannot be approved for quotation.",
          );
        for (const l of p.lines) {
          if (
            (s.roofs.find((r: RecordItem) => r.data.entityId === l.roofId)
              ?.id !== l.roofRevision &&
              l.roofId) ||
            (s.materials.find(
              (r: RecordItem) => r.data.entityId === l.materialId,
            )?.id !== l.materialRevision &&
              l.materialId)
          )
            paragraph(
              "REVISION WARNING: takeoff or material changed after this estimate. Reconcile and revise before approval.",
            );
        }
      }
      heading("6 / Qualifications and next steps");
      paragraph(
        "Rates are supplied by the author with stated source references and dates. No market prices, performance guarantees, thermal compliance or approvals are generated automatically. Review scope, measured quantities, product evidence, tax treatment, exclusions, validity and access costs before commercial issue. GPS is browser-reported point evidence and can be inaccurate or spoofed. Photographs and annotations do not establish structural safety. This snapshot is retained when later project revisions are saved.",
      );
      const range = pdf.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        pdf.switchToPage(i);
        const bottom = pdf.page.margins.bottom;
        pdf.page.margins.bottom = 0;
        pdf
          .font("Body")
          .fontSize(8)
          .fillColor("#647184")
          .text(
            `JR Roofing Intelligence | ${approval ? "Approved document snapshot" : "Draft for review"} | ${i + 1} / ${range.count}`,
            48,
            pdf.page.height - 30,
            { width, lineBreak: false },
          );
        pdf.page.margins.bottom = bottom;
      }
      pdf.end();
    } catch (error) {
      pdf.destroy();
      reject(error);
    }
  });
}
