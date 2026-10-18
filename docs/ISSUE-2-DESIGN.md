# Issue #2 — survey to tender

This review implements only Issue #2. Existing V3.6 files and all eight recovered prototype sections remain unchanged. No deployment, paid API integration, engineering approval workflow, Issue #3 feature or workforce system is included.

## User journey

1. Create/select a project in Project Register.
2. In Roof Survey Intelligence, create one survey per roof/asset. Record measured area/pitch, covering, structure/unknowns, survey date/surveyor, access, condition, leaks, insulation observations, drainage, observations and limitations.
3. Select a roof, add defect records and link photo evidence. Upload up to ten photos per batch; optional browser GPS is captured only when requested. Draw labelled rectangles in the annotation editor, then save the metadata revision.
4. In Materials & Specifications, record products or generic materials with manufacturer, unit, source reference, revision, checked date, optional HTTPS document URL/review-due date, specification and technical limitations. Optional rates require a source and date. Sources are recorded, not automatically verified; suitability is never certified.
5. In Estimating & Tenders, create separate options. Use measured quantities or link a material quantity to a roof's measured area. Add material, labour, plant, scaffold and preliminaries lines, explicit rates/sources/dates and commercial scope, exclusions, assumptions, terms and validity. Compare saved alternatives.
6. Create/download a survey or quotation PDF draft. A document captures a fixed project snapshot; later edits do not rewrite it.
7. A different manager signs in, downloads/reviews the PDF, selects the explicit review attestation and records a review note. The server checks role, independence, current snapshot fingerprint and commercial completeness before approving the exact snapshot. The same download endpoint then produces the approved-for-issue PDF with reviewer and timestamp.

Document approval is a commercial/document review only. It never certifies engineering, roof safety, thermal performance, product suitability or statutory compliance. Multiple manager accounts are provisioned locally with the existing CLI; there are no default accounts or fabricated approvals.

## Calculation policy

- All prices are GBP. Input unit rates allow at most two decimal places and require author-supplied source references/dates. No prices are seeded or inferred from historic reports.
- Measured quantities allow three decimal places. Roof-linked takeoff uses the current recorded roof area; waste is applied and the result rounded to thousandths of the line unit.
- Round each extended line to integer pennies. Sum separate category subtotals to obtain direct cost.
- Contingency = direct cost × entered contingency percent, rounded to pennies.
- Cost = direct cost + contingency. Net selling price = cost ÷ (1 − entered sales margin), rounded to pennies. Profit = selling price − cost. This is sales margin, not markup.
- VAT = entered net selling price × entered VAT percent, rounded to pennies. Gross = net + VAT. VAT defaults to an editable zero; the author/reviewer must determine the appropriate treatment.
- A blank rate stays unpriced. Partial priced-line subtotals may be shown, but full totals remain unpriced until every line has a rate. Explicit zero is permitted with source/date. Unpriced or expired quotations cannot be approved.
- Estimates retain their roof/material revision references. A changed measurement/source is flagged, and approval is blocked until the option is revised. Overdue material source review dates also block quotation approval.

Synthetic arithmetic test: material £2,200 + labour £400 + plant £300 + scaffold £500 + preliminaries £100 = £3,500 direct; 10% contingency gives £3,850 cost; 20% sales margin gives £4,812.50 net; 20% entered VAT gives £5,775.00 gross. These are test inputs, not market prices or tax advice.

## Storage, revisions and access

New record kinds: `roof`, `defect`, `photo`, `material`, `estimate`, `document`, `approval`. All writes use the existing authenticated same-origin `/api/records` endpoint and transaction/audit mechanism. Authors are manager/engineer/supervisor accounts; only managers can approve. Viewer/worker accounts cannot write these records. Existing trusted-workspace/project access boundaries remain in place.

Entities carry stable `entityId`, monotonic `version` and `previousId`. A revision must point to the current record; stale edits fail rather than overwriting another author's changes. No deletion API is added. Defects with linked photos cannot silently move to another roof.

Migration 2 adds an `evidence` table containing immutable image bytes, MIME, project and SHA-256. Snapshots contain metadata, not image blobs. Images are served through an authenticated project-checked endpoint. Client compression targets 1600 pixels; the server restricts photos to JPEG/PNG, 1 MiB and 2000 pixels per side. Metadata/annotation edits reuse the original image and retain previous revisions. Backups include evidence and document/approval snapshots.

`GET /api/evidence/:assetId` returns authorised image bytes. `GET /api/reports/:documentId.pdf` generates the stored document snapshot using local PDFKit and bundled, licensed DejaVu fonts. PDFs include project/roof details, defects, evidence gaps, annotated photos, GPS provenance, manufacturer sources, comparison/cost detail, limitations and document approval metadata. No network provider is called. Drafts and approvals retain the original fingerprint, with UTC server timestamps.

## Reference scenario

The supplied 15-page Garland Luton Executive Park report was read as a workflow reference: facility/asset details, access/inspection limitations, condition and defect evidence, photographs and competing repair/refurbishment options. Its wording, manufacturer guarantees, insulation claims and historic budgets were not copied into the application or treated as verified current facts/prices. Tests use a clearly synthetic multi-roof example, synthetic product sources and synthetic rates. The private reference PDF is not committed to this public repository.

## Limits of this review

This remains a loopback/local trusted-workspace application. Legacy browser data stays separate from the server database and is available through the recovered workspace; there is no silent migration or deletion. GPS is optional, browser-reported point evidence and is neither independent photo-location proof nor attendance tracking. No external manufacturer feed, live rates, AI service, structural certification or automatic guarantee is activated. Mobile validation is headless Chromium at desktop/tablet/mobile widths, not physical iPhone/Safari certification.
