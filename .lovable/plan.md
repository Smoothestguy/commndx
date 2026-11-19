# Phase 2

## Build sequence
1. Add staff Email/Text choices, optional personnel email, opt-out handling and safe fresh-token delivery. Audit email consumers for missing-email states.
2. Replace onboarding/registration verification rules while retaining legacy links and nonblocking code fallback. Store each onboarding/invite/info email's returned Resend ID. Use the existing RESEND_API_KEY in one authenticated 30-minute email-monitor callback: retrieve only emails sent within 72 hours without a final status, silently skip missing status, and mark bounced/complained/failed deliveries with email_bounced_at, profile badge, deduplicated admin notification and fix/resend. No webhook or new secret.
   Track personnel_onboarding_tokens.first_opened_at once through onboarding token validation only. Derive the unopened state after 24 hours for live unused links; show the profile warning and deduplicated admin notification with Resend by text, Resend by email and Fix contact & resend. Keep punch/kiosk token lookups untouched.
3. Move application approval into a manager-authorized transaction with explicit existing-person selection and safe vendor linking.
4. Add return-worker information checks, logged through the existing inbox, with eligibility and resend safeguards.
5. Replace personnel merge with an admin-only transaction, conflict preview, evidence-preserving collision handling and per-table audit counts.
6. Test only with disposable records and mocked sends, clean fixtures, and run the protected-flow regression gate.

## Scope clarification required
The hard prohibition on changes to time entries, stays/visits, check-in tokens and timesheet signatures conflicts with item 5's requirement to repoint these same records during a personnel merge. Confirm whether an explicit admin merge may update only their personnel references, preserving times, signatures, token values, paths and operational functions. Until clarified, do not implement or execute those reference changes.

## Technical safeguards
- No punch/kiosk routes, operational triggers/functions, existing schedules or clock-in behavior changes. Only the new email-monitor schedule is in scope.
- Privileged RPCs revoke default execution and grant authenticated access only with server-side role validation.
- Email monitoring uses the existing server-only Resend key and managed scheduled-callback authentication; no Resend webhook or new secret. Its 48 daily checks are bounded to pending recent emails; report the recurring-cost/30-minute detection trade-off.
- Never auto-merge or overwrite protected personnel evidence; block conflicting portal accounts.
- Report each regression as passed, failed or unverified, backed by actual checks.