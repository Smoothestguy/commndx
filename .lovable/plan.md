## Diagnosis

Uziel Garcia's onboarding link is valid and he has successfully opened it multiple times today. The real failure is downstream:

- Token `03d2e783-7b39-48b1-9dc1-09ace12b45e8` — unused, unrevoked, expires 2026-07-13. Working.
- Edge function `verify-document` (called when he uploads his SSN card) is returning:
  ```
  AI API error: 403
  "LOVABLE_API_KEY is not registered for this project"
  ```
- Since we just made the SSN card **required** for US citizens / green card / work permit holders, this AI verification step now blocks the entire flow. To Uziel, it looks like "the link doesn't work."

This affects **every** personnel currently onboarding, not just Uziel.

## Fix

1. **Re-provision the Lovable AI Gateway key** for this project so `verify-document` stops 403-ing. This is a project-level backend fix — no code change needed.
2. **Add a graceful fallback in `verify-document`**: if the AI gateway returns 403 / key-not-registered, log the failure, mark the document as `verification_status = 'pending_manual_review'` instead of hard-failing, and let onboarding continue. An admin notification is created for manual review.
3. **Client-side (`CategoryDocumentUpload.tsx`)**: when verification returns `pending_manual_review`, show "Uploaded — pending review" instead of an error, and treat it as satisfying the required-doc gate so the applicant is not blocked by an infra outage.

## Immediate action for Uziel

After the fix ships, he can reopen the same link he already has:
`https://commndx.com/onboard/03d2e783-7b39-48b1-9dc1-09ace12b45e8`

No need to resend.

## Files to change

- `supabase/functions/verify-document/index.ts` — catch 403 / key-not-registered, return `{ status: "pending_manual_review" }`.
- `src/components/personnel/onboarding/CategoryDocumentUpload.tsx` — handle the new status (badge + treat as satisfied).
- `src/pages/PersonnelOnboarding.tsx` — in Step 3 `canProceed`, accept `pending_manual_review` as valid for the SSN card requirement.
- Backend: re-provision Lovable AI Gateway key (done via the Cloud settings, not a code file).

## Out of scope

- No DB migration.
- No change to token generation, expiry, or the email templates.
- No change to which categories require the SSN card.
