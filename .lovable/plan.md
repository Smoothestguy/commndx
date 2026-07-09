## Goal

Let personnel who have logged into the Worker Portal view and update their own direct-deposit banking info, with the sensitive numbers stored encrypted at rest (pgcrypto) instead of the current plaintext columns, and every change written to `audit_logs`.

## Scope decisions (from clarifying answers)

- Encryption: pgcrypto column encryption on `public.personnel` + `bank_account_last4` for display.
- Access: any personnel row where `personnel.user_id = auth.uid()` (includes historical/inactive workers who were ever invited to the portal).
- UI: brand-new page `src/pages/portal/PortalBanking.tsx` with a nav entry, plus a summary card link on `PortalSettings.tsx`.

## 1. Database migration

Single migration that:

1. Enables `pgcrypto` (usually already on).
2. Adds columns on `public.personnel`:
   - `bank_routing_number_encrypted bytea`
   - `bank_account_number_encrypted bytea`
   - `bank_account_last4 text`
   - `banking_info_updated_at timestamptz`
   - `banking_info_updated_by uuid` (nullable, references `auth.users(id)` on delete set null)
3. Backfills encrypted columns from existing plaintext `bank_routing_number` / `bank_account_number` using `pgp_sym_encrypt(value, current_setting('app.banking_key'))`, and sets `bank_account_last4 = right(bank_account_number, 4)`.
4. Drops the plaintext `bank_routing_number` and `bank_account_number` columns *after* code migration (step 5 below). To keep the deploy safe, the migration keeps them for now and a follow-up migration drops them once code no longer reads them — noted here, not executed in the same batch.
5. Adds two `SECURITY DEFINER` RPCs (encryption key never leaves the DB):
   - `get_my_banking_info()` → returns `{ bank_name, bank_account_type, bank_account_last4, banking_info_updated_at }` for the caller's personnel row. No decrypted numbers ever leave the DB.
   - `update_my_banking_info(_bank_name text, _account_type text, _routing text, _account text)` → validates routing = 9 digits, account = 4–17 digits, `_account_type in ('checking','savings')`, resolves the caller's personnel row via `user_id = auth.uid()`, encrypts and writes, sets `bank_account_last4`, `banking_info_updated_at = now()`, `banking_info_updated_by = auth.uid()`, and inserts an `audit_logs` row (`action_type='update'`, `resource_type='personnel_banking'`, `resource_id=personnel.id`, `changes_after={masked}`, no raw numbers logged).
   - `admin_get_personnel_banking(_personnel_id uuid)` → returns full decrypted numbers only when `has_role(auth.uid(),'admin')` or `has_role(auth.uid(),'accounting')`. Used by payroll/PDF flows that today read plaintext.
6. RLS: no direct SELECT on the encrypted columns from clients — revoke column-level SELECT on the four encrypted/updated columns from `authenticated` and rely exclusively on the RPCs. Existing personnel RLS stays as-is for non-banking columns.
7. Encryption key: stored as a Postgres GUC `app.banking_key` set via `ALTER DATABASE` is forbidden per project rules. Instead, use the `vault`-adjacent pattern already available: read the key from a `SET LOCAL` inside each SECURITY DEFINER function via `current_setting('app.settings.banking_key', true)` where `app.settings.banking_key` is configured through a Cloud secret bridged by a small `_banking_key()` SQL function that reads from a private `secrets.banking` row. Simpler alternative: store the key in a one-row `private.encryption_keys` table restricted to `service_role` only and read it inside the SECURITY DEFINER functions. The plan uses the private-table approach because it needs no infra changes.

## 2. Backend code updates

- `src/pages/PersonnelDetail.tsx` (lines 845–846) currently reads `personnel.bank_routing_number` / `bank_account_number` directly. Switch it to call `admin_get_personnel_banking(personnel.id)` (admin/accounting only, gated by role) and pass the result into `DirectDepositForm`.
- `src/components/personnel/onboarding/DirectDepositForm.tsx` and `complete_personnel_onboarding` RPC: onboarding still writes plaintext today. Update the RPC to encrypt on insert (same crypto call) and set `bank_account_last4`, so newly onboarded workers land straight in the encrypted columns.
- Anywhere else that reads the plaintext columns: verified only `PersonnelDetail.tsx` reads them in the app; nothing else needs changes.

## 3. Worker Portal UI

New file `src/pages/portal/PortalBanking.tsx`:

- Header + card matching existing portal aesthetic (see `PortalSettings.tsx`).
- Loads current values via new hook `useMyBankingInfo()` → shows `bank_name`, `bank_account_type`, `••••<last4>`, and "Last updated {relative}".
- Edit form fields:
  - Bank Name (`Input`, required, max 100 chars, trimmed)
  - Account Type (`Select`: Checking / Savings)
  - Routing Number (masked `Input`, exactly 9 digits, digit-only, zod validated)
  - Account Number (masked `Input`, 4–17 digits, digit-only, confirm field to prevent typos)
- Save button calls `useUpdateMyBankingInfo()` → toast success/error via sonner.
- After save, form clears the raw fields and re-renders the masked summary.
- Read-only banner: "Your bank details are encrypted. Only you, and payroll/admin staff who process your pay, can access them."

Routing + nav:
- Register `/portal/banking` in the portal router (same file that registers `/portal/settings`, `/portal/documents`, etc.).
- Add a "Banking" entry to the portal sidebar/bottom-nav config, icon `Landmark` from lucide.
- Add a "Manage banking info" link card on `PortalSettings.tsx` that routes to the new page (keeps discovery for users who look in Settings first).

## 4. Hooks

New file `src/hooks/useWorkerBanking.ts` (naming this by domain rather than `useWorkerPortal` since existing portal hooks are per-domain):

- `useMyBankingInfo()` — `useQuery(['my-banking'])` calling `supabase.rpc('get_my_banking_info')`.
- `useUpdateMyBankingInfo()` — `useMutation` calling `supabase.rpc('update_my_banking_info', {...})`; on success invalidates `['my-banking']` and shows toast; maps common errors (bad routing length, no personnel row) to human strings.

## 5. Security & validation

- Client validation with zod (routing = `/^\d{9}$/`, account = `/^\d{4,17}$/`).
- Server validation in the RPC repeats both checks so the client can't be bypassed.
- RPCs are `SECURITY DEFINER`, `SET search_path = public`, and gated on `auth.uid()`.
- No decrypted numbers ever cross the API for portal users — only `last4`.
- Audit row written on every successful update; no PII in the audit payload (only `bank_name`, `bank_account_type`, `last4`).

## 6. Verification

- Typecheck (`tsgo`).
- Manual: log into portal as a personnel user, open `/portal/banking`, save valid + invalid inputs, confirm masked display, confirm `audit_logs` row created, confirm `PersonnelDetail` admin view still shows decrypted numbers via the admin RPC.

## Files touched

- **New**: `supabase/migrations/<ts>_personnel_banking_encryption.sql`, `src/pages/portal/PortalBanking.tsx`, `src/hooks/useWorkerBanking.ts`
- **Edited**: portal router config, portal nav config, `src/pages/portal/PortalSettings.tsx` (link card), `src/pages/PersonnelDetail.tsx` (read via admin RPC), onboarding RPC `complete_personnel_onboarding` (encrypt on write), `src/integrations/supabase/types.ts` (regenerated after migration)

## Deferred / follow-up

- After one release with dual-write confirmed working, a second migration drops the plaintext `bank_routing_number` / `bank_account_number` columns.
