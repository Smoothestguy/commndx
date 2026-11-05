# Applicant locations

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
- [ ] Audit/gate money in field-facing project views without changing admin Financials.
- [ ] Add agency editor/tags and project Agency filters using batched safe lookups.
- [ ] Add strictly hours-only two-sheet agency export; test scope/columns, staff visibility, and TypeScript.
