# Daily timesheets, non-billable personnel and quick-add

## What will change
- Add the built-in **Daily Timesheet Report** on location cards and location/day sheets, including signatures, site-local times, roles, empty ruled rows and customer approval.
- Use an uploaded sign-in template when linked to the location; otherwise use the built-in sheet. Both retain the existing private PDF, hash, lock and version-history workflow.
- Add the personnel **Non-billable** switch and muted NB markers in staffing, roster, grid and timesheets. Attendance and agency hours remain complete; personnel marked non-billable contribute no labor cost or estimated billing dollars.
- Add manager-only **Quick add** inside the shared Assign dialog: names, optional phone/vendor and non-billable switch. Create and assign the person, then offer the existing site-text dialog only when a phone is supplied. No automatic messages.
- Show missing-phone guidance on staffing rows, including the four existing Patriot personnel; do not duplicate or alter their identities.

## Assumptions
- No reference image was attached, so the PDF will follow the specified portrait-letter headings and column layout.
- Multiple stays by one person on the same location/day will be combined into one row: earliest in, latest out, sum of worked intervals; ongoing stays remain visibly open and block approval.
- Personnel-level non-billable is distinct from existing non-billable rate brackets: only the personnel flag excludes internal labor costs.

## Technical approach
- Use regenerated live types; no SQL migrations or cron changes.
- Extend the existing location-local sheet loader and introduce a shared jsPDF built-in generator, keeping Chicago payroll calculations separate.
- Allow the manager-authorized approval function to accept a built-in sheet without a template document, using the live nullable document reference; preserve validation, immutable paths, hashes and versioning. Confirm the live constraint before implementation.
- Reuse existing assignment and personnel mutations; make assignment failure recoverable without creating another person on retry.
- Centralize non-billable metadata and calculation guards, preserve hours-only agency exports, and update affected monetary exports.

## Verification
- Focused tests for local-day grouping, repeated stays, non-billable monetary exclusion and retained agency hours.
- Authenticated browser checks for location/day PDF download and appearance, default/template selection, quick-add/assignment/readback, phone guidance and mobile dialogs.
- Run relevant existing tests and the requested TypeScript check, and inspect preview diagnostics. No SMS will be sent during testing.