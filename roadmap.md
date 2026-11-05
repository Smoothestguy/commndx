# Applicant locations

# Document upload regression
- [ ] Replace automatic upload with explicit file selection and submission; isolate busy state and make phone dialog scrollable.
- [ ] Verify real PDF/image storage and row writes, access policies, failure/reopen behavior, and TypeScript.

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
