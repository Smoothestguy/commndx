# Phase 2

## Build sequence
1. Add staff Email/Text choices, optional personnel email, opt-out handling and safe fresh-token delivery. Audit email consumers for missing-email states.
2. Replace onboarding/registration verification rules while retaining legacy links and nonblocking code fallback. Add a signature-verified Resend bounce webhook and fix/resend actions.
3. Move application approval into a manager-authorized transaction with explicit existing-person selection and safe vendor linking.
4. Add return-worker information checks, logged through the existing inbox, with eligibility and resend safeguards.
5. Replace personnel merge with an admin-only transaction, conflict preview, evidence-preserving collision handling and per-table audit counts.
6. Test only with disposable records and mocked sends, clean fixtures, and run the protected-flow regression gate.

## Scope clarification required
The hard prohibition on changes to time entries, stays/visits, check-in tokens and timesheet signatures conflicts with item 5's requirement to repoint these same records during a personnel merge. Confirm whether an explicit admin merge may update only their personnel references, preserving times, signatures, token values, paths and operational functions. Until clarified, do not implement or execute those reference changes.

## Technical safeguards
- No punch/kiosk routes, operational triggers/functions, schedules or clock-in behavior changes.
- Privileged RPCs revoke default execution and grant authenticated access only with server-side role validation.
- Bounce processing rejects unsigned requests; webhook secrets remain server-only.
- Never auto-merge or overwrite protected personnel evidence; block conflicting portal accounts.
- Report each regression as passed, failed or unverified, backed by actual checks.