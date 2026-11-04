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