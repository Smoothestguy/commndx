## Diagnosis (no changes made)

### 1. Does the submit path use `.insert().select()`?
No — not in the current source. `useSubmitApplication` in `src/integrations/supabase/hooks/useStaffingApplications.ts` (lines 335–562) submits exclusively through four SECURITY DEFINER RPCs:

- `find_applicant_id_by_email` (existing‑applicant lookup, line 375)
- `has_active_application_for_posting` (duplicate check, line 391)
- `create_applicant_return_id` (new‑applicant insert, line 413) — internal `INSERT … RETURNING id INTO v_id`
- `create_application_return_id` (application insert, line 458) — internal `INSERT … RETURNING id INTO v_id` (verified full body: pure INSERT…RETURNING, no `.select()` needed)

All four are `SECURITY DEFINER`, owned by `postgres` (which has `BYPASSRLS` in Supabase), so RLS on `applicants`/`applications` does not apply to the inserts done inside them. Anon `EXECUTE` is granted on all four (verified in `pg_proc.proacl`).

There is one direct anon touch of `applicants` still in the submit code — the post‑insert geocoding block at lines 502–558 (`.from("applicants").select().single()`, then `.update()`) — but it is wrapped in a `try/catch` that swallows the error and logs it as `[Application] Geocoding failed (non-critical)`. It cannot surface the "Permission error" toast.

`PublicApplicationForm.tsx` itself only calls the `save_application_attempt` RPC (also SECURITY DEFINER) plus the mutation above.

### 2. Current policies on `applicants` / `applications` for anon
`public.applicants`:
- `Public can insert applicants` — INSERT to `{anon, authenticated}`, WITH CHECK `true`
- `Staff can view applicants` — SELECT to `authenticated` (admin/manager/user)
- Admin/manager ALL policies
- **No anon SELECT and no anon UPDATE** (dropped by the 04:21 migration)

`public.applications`:
- `Public can insert applications` — INSERT to PUBLIC, WITH CHECK `true`
- `Public can update applications via edit token` — UPDATE to PUBLIC gated by `edit_token`
- Staff SELECT (`authenticated` + role), admin/manager ALL
- **No anon SELECT** (dropped by the 04:21 migration)

Anon INSERT is still allowed on both tables. Anon SELECT is not. This is why `.insert().select()` (the pre‑RPC pattern) would fail with an RLS error at the RETURNING step, but the current RPC‑based submit does not need it.

### 3. Postgres / edge logs 22:15–22:45 UTC
Queried `postgres_logs`, `edge_logs`, and `function_edge_logs` for the window with filters for `42501`, "permission", "denied", `applicants`, `applications`, `rpc/*`, and any `status_code >= 400`. **No matching entries returned** for that window — the window only shows checkpoint/connection lines. Either the failing request never reached PostgREST (client‑side / cached bundle) or the denial rolled off before the query. Given (1) and (2), no server‑side denial was recorded.

### 4. Photo‑reuse anon reads
Prefill uses the `lookup-applicant` edge function (`src/hooks/useApplicantLookup.ts` → `supabase/functions/lookup-applicant/index.ts`), which runs with the SERVICE ROLE, not anon — it bypasses the dropped anon SELECT policies and works today (the user confirmed prefill worked). No anon read against `applications` or `storage` happens in the reuse path. The only leftover anon touch on `applicants` is the post‑insert geocoding block, which is swallowed.

## Root cause (most likely)
The live/published bundle at `commndx.lovable.app` is still running the **pre‑RPC** submit code from before the RPC switch. That older code used `.insert().select().single()` on `applicants` and `applications`; after the 04:21 migration dropped anon SELECT, PostgREST's RETURNING step now fails with a row‑level‑security error, which triggers the `err.message.includes("row-level security")` branch in `PublicApplicationForm.tsx` and shows "Permission error. Please contact support if this persists."

Evidence:
- The current source no longer has `.insert().select()` on those tables in the submit path.
- The four RPCs exist, are `SECURITY DEFINER`, and have anon `EXECUTE`.
- All required INSERT policies are still in place.
- Prefill works because it goes through a service‑role edge function.
- No 4xx or `42501` shows in PostgREST/Postgres logs for the reported window — consistent with the earlier fix not being live yet (the failing request pattern comes from a cached/unpublished bundle).

## Minimal fix (do NOT implement — diagnosis only)

**Primary:** Republish the app so the RPC‑based submit path (already merged) reaches production. This alone resolves it for any user hitting the current bundle. Ask affected users to hard‑reload after republish to bust the cached JS.

**Hardening (recommended alongside the republish):**

1. Move the post‑insert geocoding block (lines 502–558 of `useStaffingApplications.ts`) behind a SECURITY DEFINER RPC (e.g. `update_applicant_geo(_applicant_id, _lat, _lng, _is_geocodable)`) so anon no longer touches `applicants` directly. Today the failure is swallowed, but it (a) never persists coordinates for anon submitters and (b) spams the browser console with RLS errors.
2. Add explicit `GRANT INSERT, UPDATE ON public.application_attempts TO anon, authenticated` for consistency. The SECURITY DEFINER writer (`save_application_attempt`) still works today, but the missing grants are a footgun if the RPC is ever changed to `SECURITY INVOKER`.
3. No new policies needed on `applicants`/`applications` — anon SELECT should stay revoked.

**What NOT to do:** do not re‑add anon SELECT on `applicants`/`applications` to "fix" the returning step — that reintroduces the PII exposure the 04:21 migration closed. The RPC path is the correct fix and is already in the codebase.

Approve this plan to switch to build mode; I'll then apply the hardening (RPC + grants) and you can republish.