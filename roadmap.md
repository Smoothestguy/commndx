# Shift discipline
- [ ] Update public, kiosk and Field Mode early-arrival flows and extension requests/status.
- [ ] Add manager review actions and early badges; update secure shift reminders.
- [ ] Verify rules, browser flows and requested typecheck; no migrations, schedules remain paused.

# Applicant locations

# Phase 3 sign-in sheets
- [x] Manager reconciliation, reasoned acknowledgments/manual edits, blocked week close and all-source locks; live isolated project verified and archived, time entries retained. Atomic cross-write closure is unavailable in the live schema.
- [x] Deduplicated roster SMS function, supervisor no-show banner and late-sync trail chips; opt-outs preserved, service dry-run and anonymous rejection verified. No real messages sent.
- [x] Yesterday's locked private PDF email function, optional Drive implementation and validated POC email; service dry-run verified. Actual delivery not exercised because no eligible locked sheets; Drive needs GOOGLE_SERVICE_ACCOUNT_JSON and a writable service-account destination.
- [ ] Activate ten-minute roster and 07:00 Chicago delivery schedules: jobs registered but paused because existing cron credentials are anonymous and the secure sandbox connection cannot write cron. Requires private scheduler credential provisioning outside available no-migration access.
- [x] Live browser blocked-close → edit → acknowledge → close/readback, phone-width display, 30 tests and bunx tsgo --noEmit passed; no schema migrations. Separate manager/iPhone Safari unverified. Existing checkout blocker remains below.

# Phase 2 customer sign-in sheets
- [x] Customer countersign with nonblocking recorded GPS, immutable private PDF/hash, historical downloads and reason-required reopening across attendance/time mutations; live version 1 → reopen → version 2 and locked attendance edit verified. Dedicated approval page avoids covering arbitrary template rows.
- [x] Expiring kiosk links, private public signing, same-local-day roster status, 60s refresh/3s return, check-out confirmation, GPS override and letter QR posters. Live sign-in/private signature, no-GPS/reason override, token/roster/auth/stale-state boundaries verified. Checkout remains blocked by existing live function below.
- [x] Seven-day location status board with clickable sheets and reusable-template action/picker; live shared-file row/field copy verified. No migrations.
- [x] Live admin browser verification, 390px customer approval/tablet kiosk, PDF text/render inspection, 20 focused tests and requested TypeScript check; temporary fixtures removed. Actual iPhone Safari/separate manager unverified. UI guards protect manual edits; database-wide lock enforcement is not present in the live schema and was not added under the no-migrations constraint.

# Deployment data-flow fixes
- [x] Same-local-day Field Mode visits, flagged stale closure and review clearing; live stale-shell closure verified at location end-of-day.
- [x] Required private check-in signatures, same-day copy-forward and durable public signature retries; live public and two-person Field Mode signatures verified. New signatures use private project-documents rather than public field-captures.
- [x] Canonical time-entry hours/costs and shared assignment/status counts; list/header previously collided under one cache key with different result shapes. Time Tracking KPIs now use selected date window.
- [x] Crew prompt and editable route-mileage estimate; live crew creation and estimate dialog verified; haversine/factor/order rules tested.
- [x] Personnel stats resolve using parallel exact counts rather than sequential full-record loads; compact time KPIs, 24 tests and requested TypeScript passed. No migrations/layout changes; temporary fixtures removed; actual iPhone Safari and separate manager account unverified.
- [ ] Live checkout → generated time-entry verification blocked by existing server sync_visit_time_entry: INSERT omits required time_entries.user_id (NOT NULL, no default), so checkout rolls back. Requires owner/live-server correction; no migration or workaround applied.

# Phase 1 location customer sign-in sheets
- [x] Live types; location coordinates, timezone and geocoding with manager-only authorization; no migrations. Numeric-coordinate fallback used instead of a map preview; live address lookup and coordinate save/readback verified.
- [x] Binding/scope/resizable row-band editor, template upload/location links and reusable template copy. Live upload, tablet resize/save and shared-file copy verified.
- [x] New punch RPC arguments, geofence rejection/override UX and durable offline retries. Phone UI tested with intercepted responses for out-of-range/no-GPS/already-signed/local times/offline original-time replay; live punch writes and actual iPhone Safari not exercised.
- [x] Location/day PDF and ZIP generation with local times, overflow and staff-only off-site badges; existing blank template converted without altering signatures. Populated real-stay PDF and day ZIP downloaded and PDF text/placement inspected; sheet entrypoints available in Docs and Deployment.
- [x] Eighteen focused rule tests and requested `bunx tsgo --noEmit` passed; preview build OK; temporary documents/shared file/location removed. Signed-in admin tested; no separate manager account available. Legacy Mapbox token endpoint now refuses secret tokens; credential rotation remains an owner action if it previously exposed a secret token.

# Signature field placement and stamping
- [x] Regenerate live types; add manager PDF field placement and saved normalized fields without migrations.
- [x] Stamp original pages per signer, retain certificates, add multi-signer ZIP and token-page placement note. Generate on download only; optional stamped thumbnails skipped.
- [x] Twelve tests and `bunx tsgo --noEmit` passed. Signed-in admin live field save/reload, simulated signed recipients, individual PDF/2-file ZIP, downloaded PDF render and certificate verified; top-origin alignment confirmed. 390px drag/delete/save and anonymous valid-token note passed; fixtures removed, no SMS or migrations. Separate manager login and actual iPhone Safari not exercised.

# Document upload regression
- [x] Replace automatic upload with explicit file selection and submission; isolate busy state and make phone dialog scrollable.
- [x] Verify live PDF/image storage, metadata inserts and list refresh, private file readback, denied anonymous reads, failure/reopen behavior, 390px/short-height scrolling, six rule tests and `bunx tsgo --noEmit`; fixtures removed. Admin session verified; no manager account exists, so manager end-to-end and actual iPhone Safari remain unverified. Minimal document policy hardening applied for discovered anonymous access; upload INSERT policy unchanged.

- [x] Add shared formatting and missing-ZIP batch lookup.
- [x] Update staff applicant lists and information views; leave public forms and database unchanged.
- [x] Verify fallback behavior and compilation; report affected views and files.

# Location shifts, midnight hours, and lodging
- [x] Regenerate live types and add location shift overrides with project inheritance.
- [x] Split timesheet/export and supervisor/manual attendance hours at Chicago midnight; test rules.
- [x] Default location lodging to active location personnel, preserving project-only behavior.
- [x] Verify authenticated location dialogs/timesheet/XLSX and requested TypeScript check; no migrations. Live attendance writes not exercised.

# Offline punching and geo tags
- [x] Regenerate live types and update punch calls with original timestamp.
- [x] Add route-scoped offline shell, durable punch queue, retry guards, and bilingual saved state.
- [x] Add Field Mode offline warnings and Visits/PDF/confirmation GPS tags.
- [x] Test queue/reconnect/reload using intercepted RPCs, generated worker offline reload, authenticated GPS links/PDF display, and TypeScript; no migrations. Real punch writes and published deployment not exercised.
# Document signatures
- [x] Regenerate live types; deploy private token signing and authenticated text requests, no migrations.
- [x] Add mobile signing page, shared Field Mode pad, document upload/status/recipient/certificate UI and location links.
- [x] Verify a live test PDF upload → anonymous signature → reload → staff tracking → signed certificate download; test idempotency, signed-remind skip, invalid auth/token and rules; clean up fixture; TypeScript and preview passed. No real SMS sent. Signature evidence uses private project-documents rather than the existing publicly readable field-captures bucket.

# Rate privacy and agency hours
- [x] Audit/gate money in field-facing project views, roster, deployment receipts/mileage, asset creation, header contract value and financial project PDF export; admin Financials unchanged.
- [x] Add clearable agency editor/tags and project Agency filters with authenticated project-scoped batched minimal-projection lookup; no migrations.
- [x] Verify populated Edilberto Quiros agency XLSX from selected week with exactly Timesheet/Detail and no money columns; workbook scope/privacy/open-punch tests and TypeScript passed. Authenticated mobile flows passed; plain-user presentation gates checked with intercepted role response, not a separate real plain-user session; agency write not exercised.
