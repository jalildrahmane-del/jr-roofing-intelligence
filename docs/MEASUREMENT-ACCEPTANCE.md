# Preliminary measurement export acceptance — 18 November 2026

PR #81 extends the interactive roof plan sketch with a local JSON download.

- [x] Export vertices, calibration, pitch, unrounded computed areas, perimeter and all boundary edges.
- [x] Label the format/version, export time and preliminary/unverified status; explicitly exclude imagery and approved/payment quantities.
- [x] Chromium downloads and parses the actual file at desktop (1440px) and mobile (390px) widths.
- [x] Rectangle fixture checks 200m² area and 60m perimeter; pitch 60° gives 400m² surface; halving calibration gives 50m² plan area.
- [x] Pitch/calibration edits and undo invalidate the download until recalculation; clearing/invalid calculation prevents download.
- [x] Existing tender workflow still completes with no page errors.
- [x] Full local validation and GitHub CI passed for export head `5255a4d92355c9284e544eb884d441eccad87bfd`; PR #81 merged as `a17ff842e310493e1a888084fd97a0bdf68860a3`.

These are synthetic Chromium checks, not physical iPhone Safari acceptance. The sketch uses a user-provided raster and verified calibration; georeferenced aerial imagery, independent engineering approval and estimation adoption are not delivered by this export. AI remains disabled. PRs #70/#79 retain their explicit attendance-policy review holds. Issues #4/#5/#18/#58 are not declared complete.


## Boundary correction follow-up

- [x] Number boundary vertices on the sketch and select a point using an accessible control.
- [x] Apply finite coordinates within the 1000 × 600 sketch grid, or remove a selected point.
- [x] Invalid coordinates preserve the existing boundary; applied edits/removals invalidate calculated/exportable results.
- [x] Desktop/mobile Chromium checks verify corrected area, actual export, revision save and page-reload persistence.
- [ ] Full local regression and GitHub CI on this follow-up before merge.

Coordinate drafts only change the boundary when Apply point is pressed. Existing geometry checks still reject degenerate/self-crossing polygons on recalculation. No automatic estimate adoption or independent approval is added.
