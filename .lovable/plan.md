# Phase 1 — Duplicate prevention and contact verification codes

Nothing here touches clock-in/punch links, kiosk, site check-in, time, assignments, payroll, badges, or layout beyond the items below. No existing rows are deleted or auto-merged.

## What gets built

1. **Consistent contact format** — email saved lowercase/trimmed, phone saved as its last 10 digits, on every save of personnel, applicants and registrations (a database rule, so every path behaves the same). Existing rows are normalized once (formatting only); nothing else is changed.
2. **One shared "possible match" check** for staff, run before saving in: Add Personnel, Quick Add on a site, CSV import (each row), and registration approval.
   - Card: "Possible match: {name} {P-number} · same phone · added {date}" with **Use existing** / **Create anyway**.
   - Same email: blocked unless an admin picks Create anyway and enters a reason (saved in audit).
   - Same phone or similar name: warning only.
   - CSV import: new review step; matched rows default to **Skip**.
   - Registration approval: admin can link the registration to the existing person instead of creating a new one.
3. **Verification codes** (6 digits, 10-minute expiry, 5 wrong tries max, 3 sends per contact per hour, stored scrambled, never sent back to the browser). Email via the existing Resend sender; text via existing Twilio, skipping opted-out numbers. Bilingual message.
   - Onboarding and registration forms: must verify both email and phone before final submit. Profile shows "Email verified ✓ / Phone verified ✓".
   - Public apply form: no code for normal new applicants (Watchdog untouched). Codes only in conflicts.
4. **Conflict rules on worker forms** (replaces today's apply-form behavior that overwrites email/phone without proof — security fix):
   - Email + phone both match → link, no staff fields changed.
   - Only email matches → code to that email. Correct → link and update phone (old phone kept in audit). "I can't get the code" → submission accepted, existing record untouched, Needs review item created.
   - Only phone matches → same flow with a text code.
   - Worker only ever sees: "This contact is already on file. Enter the code we sent to confirm it's you."
5. **Needs review queue** on Personnel (admin/manager), with badge count. Shows submitted vs existing contacts. Actions: Same person – update contact / Same person – keep existing / Different person (optional text/email asking them to use their own contact). Every decision audited.
6. **Possible duplicates list** on Personnel: groups by same email / same phone / similar name. **Merge** opens the existing merge tool; **Not duplicates** dismisses the group permanently.

## Verification
Disposable fixtures only, removed in the same run; all texts/emails in dry-run mode. Tests: Add Personnel warning, approval links existing, new applicant with no code, email-match/different-phone (correct code → linked + phone updated; skipped → needs review and record unchanged), onboarding requires both codes, rate limits and expiry. Report lists every new table/function and anything unverified.

## Technical details
- Migration: normalization triggers + one-time normalization backfill on `personnel`, `applicants`, `personnel_registrations`; columns `email_verified_at`, `phone_verified_at` (personnel, registrations); tables `contact_verification_codes` (hash, purpose, attempts, expires_at; service-only), `contact_review_items` (submission vs matched record, status, decision, actor), `duplicate_dismissals` (sorted entity-id pair, reason, actor). RLS manager/admin, explicit grants, no anon grants.
- Functions: `find_contact_matches(first,last,email,phone)` SECURITY DEFINER, unaccent/lower name comparison including prefix ("Modesto Diaz" ~ "Modesto Diaz Jimenez"), EXECUTE only authenticated+role check and service_role; `personnel_duplicate_groups()` manager-only; review decision RPC with audit.
- Edge function `contact-verification` (send/verify; token-scoped context: onboarding token, registration invite, apply token), returns only status; `DRY_RUN` flag for tests. Verified proof returned as short-lived signed server-side record id, consumed at submit.
- `submit_public_application` replaced by new migration: stop overwriting email/phone on single-key match; return `verification_required` with no identity details; accept proof id or "skip" → review item.
- `approve-personnel-registration`: optional `link_personnel_id` path (updates only blank fields + links user), no new row.
- Shared React `PossibleMatchDialog` + `useContactMatches`; CSV import review step.
- Large scope: built in this order — normalization/matching → staff entry points → codes + worker forms → review queue → duplicate groups → verification.
