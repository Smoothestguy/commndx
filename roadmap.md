# Existing stay corrections
- [x] Shared manager/admin Edit times dialog from project/location Timesheet cells and Trail In/Out, including running stays, source chips, location-local dates/times and staged per-stay deletion.
- [x] Per-person writes preserve signatures/source; original/proposed operational and payroll dates guard closed weeks and locked entries, sheet reopening reserves versions, attendance recomputes and audits drive pencil markers. Deleting a stay preserves private storage/audit evidence and zeros its existing financial row; invoiced stays are blocked. Multi-request client guards are not atomic server lock enforcement.
- [x] Eighteen tests, bunx tsgo --noEmit and preview build passed. Live admin browser verified project and location open-stay close → 9h, Trail in correction → 8h, sheet cancel unchanged, reasoned version reopening → 7h, locked-time-entry rejection, pencil marker and deletion → zero attendance/canonical hours with financial row retained; 390px dialog inspected, no runtime errors. Test people/locations inactive, financial history retained at zero. Separate manager/field-user accounts, actual Safari and live week_closeouts row creation not exercised; closed-week/date-boundary rules covered by source/test checks. No schema changes/messages.

# Manual time in/out inside locations
- [x] Manager/admin grid time inputs use existing manual-visit saver instead of hours-only writes; blank times retain status/hours, partial/reversed times cannot save, computed hours are read-only and manual cells show pencil markers.
- [x] Location-locked Log time in header, Attendance toolbar, Trail and person-day cells; picker uses active location roster independently of lifecycle status, per-cell date/person prefill, location-local time conversion and shared cache refresh.
- [x] Eleven focused tests, bunx tsgo --noEmit and latest preview build passed. Authenticated admin browser saved 8.5 hours from location dialog and 2 hours from press-and-hold grid; trail, attendance and non-billable canonical time_entries readback confirmed. Person/day prefill and pencil markers checked, zero runtime errors. Fixtures inactive/soft-deleted, history retained; no database schema changes or messages. Separate manager/field-user sessions and actual Safari not tested.

# White-labeled agency portal
- [x] Manager logo upload/preview/remove in vendor detail and both editors; token create/copy/revoke/QR on detail, desktop rows and mobile cards. Unique public logo objects and metadata-only removal avoid shared-file deletion; live manager RLS preserved.
- [x] Token-only light agency portal: date attendance/stats, Mon–Sun weekly hours and XLSX, status-grouped roster including unassigned; agency-first logo/wordmark and customer attribution. Worker punch branding uses info RPC with logo fallback; optional join branding skipped because live join info omits agency fields.
- [x] Regenerated live types; 8 privacy/week/export/120-day/role tests and bunx tsgo --noEmit passed; latest preview build OK. Live admin upload/readback/remove, token create/copy/QR/revoke, anonymous vendor isolation, populated 11.64-hour attendance/weekly XLSX and workbook contents verified; 390px views inspected, zero runtime errors. Punch branding checked with intercepted info only, no punches. Temporary fixtures soft-deleted and links revoked; no migrations/messages/cron changes. Separate manager login and actual Safari not exercised.

# Task-order refinements
- [x] Shared direct requirements add/change/remove and location-editor saves record accepted internal ADJ deltas without sync; explicit legacy baseline capture maintains authorization consistency. Web Locks and expected-state guards reduce concurrent edits; rejected evidence survives incomplete saves. No atomic multi-request guarantee without a live transactional RPC.
- [x] Optional effective time, Yes/No travel-time and structured demobilization details in staff and token-only customer forms/history; accepted demob Deployment alerts. New token-validated service wraps existing customer RPCs, which omit the live extra columns; no anonymous table grants.
- [x] Regenerated types; 34 focused tests, bunx tsgo --noEmit and latest preview build passed. Authenticated admin browser verified direct 0→1→3 and decreases, internal demob save/sync, public pending submission→acceptance→customer readback and Deployment extras, plus 390px staff/customer forms. Test staffing/authorization restored to zero and customer links revoked; historical evidence retained. No migrations/messages/cron changes. Separate manager login, real Safari and failure-injection/concurrent cross-user writes not tested.

# Navigation and location pages
- [x] Full-width deep-linked location page reuses staffing/requirements/join requests, scoped attendance/trail, visits/status/sheets/countersign, embedded task-order ledger/as-of, lodging, assets and scoped documents/signatures; existing edit/kiosk/QR/join/daily actions remain permission-gated. Scoped sheet cache keys prevent project/location collisions.
- [x] Real location titles/grid names, project card titles and personnel staffing/roster/trail/timesheet/mobile names; native anchor right-click retained. Card/grid/person context actions reuse edit/assign/text/kiosk/daily/taskorder and log/expense/role/unassign handlers. Project cards retain archive and gain Status submenu. Actions absent from a surface remain omitted rather than invented.
- [x] Project tab, Cards/Grid, Deployment sub/week, Timesheet shift/location/agency/search and Trail filters persist in URL; choices push and typing replaces. Verified Back returns to Cards/Grid and restores nested grid scroll 190→190. Local storage remains the view default.
- [x] bunx tsgo --noEmit, 41 focused tests and latest preview build passed. Authenticated admin browser verified plain/Ctrl/middle click, native anchor context event, card/grid/person menus, log-time opening, direct taskorders, scoped attendance, location document upload opening, repeated edit opening, deployment week/filter history, project Status submenu and 390px layout; no runtime errors. No database changes, messages, fixtures or cron changes. Actual Safari/Cmd on macOS and write submissions were not exercised; no new kiosk tokens were minted during checks.

# Customer portal
- [x] Regenerated types; isolated light-theme token-only attendance/history, grouped counts/24h times, submitted TO form/history and 60s messages with remembered name. Recursive allow-list parsers strip unexpected financial metadata; anonymous browser made only the five customer RPC requests and no table reads.
- [x] Manager header-menu portal create/list/revoke/copy/QR with 120d default, location submitted-order accept/reject guards and requirement sync-only retries, customer-scoped Docs/Activity threads, FRG replies using profile name and read_at updates only for viewed customer messages.
- [x] Deployment submitted/unread links verified; live anonymous submission remains unauthorized until staff accepts, sync headcount 5 and customer status/authorization readback, rejection leaves 5, customer message→FRG reply→public readback, read marker, name persistence/history arrow/cross-location denial and revocation→office state passed. 390px list/form and desktop inspected; fixtures archived/inactive and portal revoked, no migrations/SMS/cron changes. Separate manager/user login, Safari, full 60-minute rate-limit and actual on-site/done stay examples not exercised.
- [x] 34 focused tests and bunx tsgo --noEmit passed; preview healthy. Backend overview omits location timezone and queries currently active assignments for historical dates; portal explicitly shows Central Time fallback rather than inventing timezone/history data. Existing unrestricted authorization RPC risk below is unchanged under no-migrations restriction.

# Location customer task orders
- [x] Regenerated live types; manager card/grid creation/history with customer reference, signed position/asset lines, effective dates, notes, private document picker/upload and creator; historical RPC totals and explicit requirement sync with sync-only retry. Live initial +5 Operator/+2 Pump, decrease -2, increase +2, demobilization -5 and net-zero requirement readback verified.
- [x] Staff authorized/actual indicators, location-linked Deployment strip and deterministic once-per-location/kind/local-day in-app alert_log reservations deployed in roster-alerts; no authorization SMS. Live unassign → replacement preselected Operator → assign/readback verified; unassign preserves rows and reassign restores live unique pair. Daily job dry-run passed with one authorization banner and zero sends; cron remains paused.
- [x] Historical daily PDF header Authorized: 5 verified in downloaded PDF; locked evidence unchanged. 390px list/editor and desktop inspected, 32 focused tests and bunx tsgo --noEmit passed, preview build OK. Fixtures archived/location inactive/person inactive/assignment closed; historical TOs/doc retained. Actual asset assignment count changes, separate manager/user login and Safari not exercised.
- [ ] Existing live authorization RPC security: both SECURITY DEFINER functions allow anonymous EXECUTE and lack in-code caller checks; requirement sync also lacks manager authorization. Needs live-server owner hardening (staff-only read, manager-only mutation) because migrations/schema changes are explicitly prohibited in this task. No grant/function changes made.

# Join approval correction
- [x] Pending-only bilingual confirmation; public result parser discards unexpected punch/identity fields and requester never sees a punch link.
- [x] Shared project-batched staff approval lists in Deployment and location/grid staffing headers, matched directory names, live approve/deny RPCs, roster invalidation and server-derived SMS action. Existing message IDs reserve one send per request; failed-text retries never reapprove and uncertain delivery is not automatically replayed.
- [x] 19 tests and bunx tsgo --noEmit passed. Live anonymous pending → authenticated matched-placeholder approve → phone filled/no duplicate → staffing readback → deny verified; deployed SMS dry-run validated committed token/assignment and invalid auth rejected. 390px confirmation inspected, test fixtures archived/inactive, tokens expired/revoked; no real SMS, migrations or cron changes. Separate user login and actual provider delivery not exercised.

# Project join links
- [x] Regenerated live types; bilingual anonymous registration, inline validation, office invalid state and personal punch-link success implemented. Actual live join_project returns pending approval, which is displayed truthfully.
- [x] Manager project menu/location card/mobile+desktop grid actions, scope/employer/NB/role/30-day expiry, copy/QR/SMS shortcut and revocation; project roster/staffing invalidates on focus.
- [x] 17 rule tests and bunx tsgo --noEmit passed; live authenticated link create/readback → anonymous register/repeat → revoke verified, 390px screens inspected. Test requests denied via live RPC and tokens revoked; no personnel or SMS created. Personal punch success verified with intercepted response only.
- [x] Direct-join discrepancy superseded by user's staff-approval correction; keep live pending-request behavior and build authenticated approval below.

# Daily timesheets and non-billable personnel
- [x] Built-in location/day customer PDF, linked-template precedence and private approval/lock flow; live populated location PDF downloaded and isolated template-free approval/hash/storage readback verified. Employee signature/footer rendering inspected with synthetic evidence.
- [x] Non-billable editor/labels and money exclusions while retaining attendance and agency hours; distinct from non-billable rate brackets.
- [x] Manager quick-add/assignment with optional text offer and no-phone guidance; live no-phone/non-billable and phone-supplied offer tested without sending. 390px form inspected; test project archived and personnel inactive, historical approval retained.
- [x] 31 focused tests, authenticated admin browser verification, requested TypeScript check and healthy preview; no migrations or cron changes. Separate manager login and actual Safari not exercised.
- [x] Corrected customer employer labels, exclusive editor/inline choices and FRG/agency/customer quick-add; agency filters/reports remain vendor-only. Regenerated live types, deployed minimal employer metadata, 20 tests and bunx tsgo --noEmit passed. Authenticated live customer quick-add/assignment → editor save/reload and 390px form verified; test personnel deactivated/assignment closed, Patriot records unchanged. No migrations or cron changes.

# Kiosk privacy, badges and agency sign-up
- [x] Search-default, explicit roster/selfie and badge modes with URL mode, bounded live search, selected short-lived profile photos, private token-scoped media, server-enforced selfie prerequisite and shift/geofence safeguards. Private project-documents stores evidence because field-captures is public.
- [x] Manager badge issue/replacement/revoke, individual and selected/all roster PDFs and Field Mode scanner through authenticated signature-aware punch flow. Live individual issue/PDF (3.5×2.25 in), kiosk badge and Field Mode same-day copy-forward verified. Bulk PDF and physical-camera QR capture not exercised.
- [x] Vendor detail hiring links, server-owned agency submit/QuickApply, cached applicant chips and conversion carry-forward without overwriting agency with personal QB vendor. Existing applicant attribution retained; contact-only existing applicants are not retagged. No general application page exists. Live new agency submission/readback and carry-forward fixture verified; full public form→approval UI and QuickApply invite path not exercised.
- [x] Live search→selfie/signature→punch→private evidence readback and induced media failure→retry with one punch/two media attempts passed. Phone roster/search and desktop success inspected; TypeScript and 34 focused tests passed. No migrations, cron changes, SMS or onboarding messages. Test records archived, test kiosks expired/badges revoked, historical evidence retained. Actual iPhone Safari and physical cameras remain unverified.

# Shift discipline
- [x] Update public, kiosk and Field Mode early-arrival reason flows; durable intents retain server effective timestamps. Public extension requests show current token-scoped status and fifteen-minute choices capped at six hours.
- [x] Add manager-only review function, banners in Deployment/Visits and early badges; preserve reasons with approval markers. Extensions support approve/deny; early arrivals support approve only because the live schema has no independent denial marker. Preshift day/night and extension-aware nags deployed; cron untouched.
- [x] Live isolated public signature/early request/extension → staff approve/deny → readback, kiosk signed early punch, Field Mode server gate/retry, and five-minute auto-accept passed. Phone screens checked; 44 tests and bunx tsgo --noEmit passed. No SMS or migrations; fixtures cleaned/archived. Actual iPhone Safari, separate manager login, and full Field Mode UI early flow unverified.

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
