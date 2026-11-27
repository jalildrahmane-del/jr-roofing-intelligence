# Product acceptance baseline — 22 November 2026

This is a fixed reporting scope, not a completion percentage. Earlier 65%/70% estimates were not derived from acceptance criteria and are withdrawn. Count a row complete only when every linked requirement has implementation, passing verification, compatibility evidence and any required owner acceptance. Split rows only with a recorded scope change; never count PRs as completed product requirements.

| ID | Scope | Current acceptance status / evidence |
|---|---|---|
| A01 | Interactive aerial imagery and roof selection | Outstanding: geographic preview is not an imagery map. |
| A02 | Geographic measurement and pitch/quantity integration | Partial: calibrated raster measurement/export exists (PR81/82); projected geographic measurement remains outstanding. |
| A03 | Geographic outline editing and revision history | Partial: import, edit, undo, export, save/reload/remove, restore implemented (PR87–103); physical-device acceptance outstanding. |
| A04 | Multi-roof survey and GPS-linked evidence | Partial: integrated tender browser coverage; complete field acceptance outstanding. |
| A05 | Estimating, materials and tender exports | Partial: PDF and XLSX implemented (PR85); full requirement-to-test audit outstanding. |
| A06 | Attendance and reconciled hours | Partial/owner-held: Issues5/18, drafts70/79; GPS exceptions and overlap policy decisions outstanding. Never count disputed hours as verified. |
| A07 | Construction, daily reports, materials and programme | Partial: Issue18; full acceptance reconciliation outstanding. |
| A08 | Document intelligence, source-linked RAMS/CPP | Partial: Issue4; human-authored review exists, AI remains disabled pending separate authorization. |
| A09 | Engineering, QA and handover | Partial: independent approvals must remain; complete acceptance reconciliation outstanding. |
| A10 | Security, project permissions and audit | Partial: automated coverage exists; consolidated security acceptance audit outstanding. |
| A11 | Backup, restore, retention and recovery | Partial: implementation exists; complete recovery/retention evidence audit outstanding. |
| A12 | Integration, V3.6 compatibility and mobile field acceptance | Partial: CI/browser regression exists; physical iPhone and owner acceptance outstanding. |

Open scope sources: Issues4,5,18,58 and owner-approved feature checklist. These rows establish stable reporting categories; they do not certify exhaustive requirement coverage. Next audit must attach each detailed acceptance criterion and test evidence before publishing an overall percentage. AI authorization and engineering/attendance owner decisions must remain visible separately from coding completion.

Current change: validated geographic vertex removal, minimum-three guard and undo regression. Build/browser results and GitHub CI belong in its PR; no field acceptance is implied.

Geographic editing follow-up: insert entered coordinates after the selected vertex, validate topology/duplicates before applying, cap at 500 vertices, and support undo. Browser coverage includes duplicate rejection, ordered insertion and undo on desktop/mobile. A03 remains partial pending broader acceptance; no percentage change is claimed.

Geographic redo follow-up: bounded redo history for undone edits, cleared on new edits, valid replacement import, clear or restore. Desktop/mobile regression covers redo of removal, repeat undo, and redo invalidation after insertion. A03 remains partial.

Geographic CSV export: ordered vertices, numeric longitude/latitude in degrees, EPSG:4326 and preliminary-unverified status. Local geometry tests and desktop/mobile actual-download checks pass. No projected quantities or overall completion percentage implied.

Direct GeoJSON paste/import: validates with the file-import parser, preserves geometry on invalid input, cancels pending reads, resets history on success, and clears successful pasted text. Desktop/mobile browser checks cover invalid and valid paste. A03 remains partial.

Preliminary geographic distances: spherical Haversine edge lengths and closing perimeter displayed in metres, recalculated from validated current vertices. No slope/elevation, area, estimate adoption or engineering approval implied. Local known-distance, latitude, reversal and invalid-geometry tests plus desktop/mobile browser checks pass. A02 remains partial; projected area and aerial imagery remain outstanding. Method reference: https://turfjs.org/docs/api/distance and https://turfjs.org/docs/api/constants/earthRadius .
