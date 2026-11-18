# Preliminary measurement export acceptance — 18 November 2026

PR #81 extends the interactive roof plan sketch with a local JSON download.

- [x] Export vertices, calibration, pitch, unrounded computed areas, perimeter and all boundary edges.
- [x] Label the format/version, export time and preliminary/unverified status; explicitly exclude imagery and approved/payment quantities.
- [x] Chromium downloads and parses the actual file at desktop (1440px) and mobile (390px) widths.
- [x] Rectangle fixture checks 200m² area and 60m perimeter; pitch 60° gives 400m² surface; halving calibration gives 50m² plan area.
- [x] Pitch/calibration edits and undo invalidate the download until recalculation; clearing/invalid calculation prevents download.
- [x] Existing tender workflow still completes with no page errors.
- [ ] Full CI on the updated head required before merge.

These are synthetic Chromium checks, not physical iPhone Safari acceptance. The sketch uses a user-provided raster and verified calibration; georeferenced aerial imagery, independent engineering approval and estimation adoption are not delivered by this export. AI remains disabled. PRs #70/#79 retain their explicit attendance-policy review holds. Issues #4/#5/#18/#58 are not declared complete.
