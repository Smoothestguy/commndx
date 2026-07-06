## Problem

Jose Cortes (and, in fact, every new personnel) sees **"Invalid or expired link"** when opening his onboarding URL.

His data is fine:
- Personnel record active, onboarding_status = `pending`.
- Two `personnel_onboarding_tokens` rows for him, both unused, unrevoked, and valid until 2026-07-13. Latest token: `2d2b2507-4ebd-49e1-9c49-d52d46507ef8`.

## Root cause

`/onboard/:token` (`PersonnelOnboarding` → `useOnboardingToken`) queries `personnel_onboarding_tokens` with the public anon client. RLS on that table only allows:

- `service_role` → insert/update
- `authenticated` admins/managers → select

There is **no `anon` SELECT policy**. So the anon query returns `null`, the hook treats it as `isValid: false`, and `InvalidLinkScreen` renders — even though the token is perfectly valid.

Interestingly, `personnel` already has a matching anon policy ("Anonymous can view personnel with valid onboarding token") that assumes the tokens table is anon-readable. That assumption was never made true, so the whole public flow is dead.

## Fix

One migration: add a narrowly-scoped anon SELECT policy on `personnel_onboarding_tokens`, matching the pattern already used on `personnel` and on `vendor_onboarding_tokens`.

```sql
CREATE POLICY "Anonymous can view valid onboarding tokens"
ON public.personnel_onboarding_tokens
FOR SELECT
TO anon
USING (
  used_at IS NULL
  AND revoked_at IS NULL
  AND expires_at > now()
);

GRANT SELECT ON public.personnel_onboarding_tokens TO anon;
```

Security notes:
- Lookup is always by exact UUID token from the URL — not enumerable.
- Policy hides expired/used/revoked rows, so a leaked-then-consumed token stops being anon-readable.
- Mirrors the existing anon policy on `personnel` and matches the "Anonymous Onboarding Access" pattern already in project memory.
- No app code changes; existing `useOnboardingToken` hook starts working immediately.

## Verification

1. After migration runs, open `https://commndx.com/onboard/2d2b2507-4ebd-49e1-9c49-d52d46507ef8` — should load Jose's onboarding form instead of the invalid-link screen.
2. Confirm expired/revoked token still shows the invalid-link screen (RLS filter excludes them).
3. No change to authenticated admin/manager access.

## Out of scope

- Jose's email is stored uppercase (`PARADISALFIELDS@GMAIL.COM`). Not the current bug and not touching it here; can be normalized separately if you want.
- No changes to the resend/email edge functions — link format and token generation are already correct.
