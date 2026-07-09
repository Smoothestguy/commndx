
-- Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. Private encryption key store (never exposed to clients)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE USAGE ON SCHEMA private FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS private.encryption_keys (
  name       text PRIMARY KEY,
  key        text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.encryption_keys FROM PUBLIC;
REVOKE ALL ON private.encryption_keys FROM anon, authenticated;
GRANT ALL ON private.encryption_keys TO service_role;

-- Generate a random 32-byte key once
INSERT INTO private.encryption_keys(name, key)
SELECT 'banking', encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM private.encryption_keys WHERE name = 'banking');

CREATE OR REPLACE FUNCTION private._banking_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private
AS $$
  SELECT key FROM private.encryption_keys WHERE name = 'banking'
$$;
REVOKE ALL ON FUNCTION private._banking_key() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2. Encrypted banking columns on personnel
-- ============================================================
ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS bank_routing_number_encrypted bytea,
  ADD COLUMN IF NOT EXISTS bank_account_number_encrypted bytea,
  ADD COLUMN IF NOT EXISTS bank_account_last4            text,
  ADD COLUMN IF NOT EXISTS banking_info_updated_at       timestamptz,
  ADD COLUMN IF NOT EXISTS banking_info_updated_by       uuid;

-- Backfill from existing plaintext values (kept during dual-write period)
UPDATE public.personnel
SET bank_routing_number_encrypted = pgp_sym_encrypt(bank_routing_number, private._banking_key()),
    bank_account_number_encrypted = pgp_sym_encrypt(bank_account_number, private._banking_key()),
    bank_account_last4            = right(bank_account_number, 4)
WHERE bank_account_number IS NOT NULL
  AND bank_account_number_encrypted IS NULL;

-- Prevent clients from reading the raw encrypted bytea columns
REVOKE SELECT (bank_routing_number_encrypted, bank_account_number_encrypted)
  ON public.personnel FROM anon, authenticated;

-- ============================================================
-- 3. Worker self-service RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_banking_info()
RETURNS TABLE(
  bank_name               text,
  bank_account_type       text,
  bank_account_last4      text,
  banking_info_updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.bank_name,
         p.bank_account_type,
         p.bank_account_last4,
         p.banking_info_updated_at
    FROM public.personnel p
   WHERE p.user_id = auth.uid()
   LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_my_banking_info() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_my_banking_info(
  _bank_name    text,
  _account_type text,
  _routing      text,
  _account      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_personnel_id uuid;
  v_email        text;
  v_key          text;
  v_last4        text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF _bank_name IS NULL OR length(btrim(_bank_name)) = 0 OR length(_bank_name) > 100 THEN
    RAISE EXCEPTION 'Bank name is required (max 100 characters)';
  END IF;
  IF _account_type IS NULL OR _account_type NOT IN ('checking','savings') THEN
    RAISE EXCEPTION 'Account type must be checking or savings';
  END IF;
  IF _routing IS NULL OR _routing !~ '^\d{9}$' THEN
    RAISE EXCEPTION 'Routing number must be exactly 9 digits';
  END IF;
  IF _account IS NULL OR _account !~ '^\d{4,17}$' THEN
    RAISE EXCEPTION 'Account number must be 4-17 digits';
  END IF;

  SELECT id INTO v_personnel_id
    FROM public.personnel
   WHERE user_id = auth.uid()
   LIMIT 1;

  IF v_personnel_id IS NULL THEN
    RAISE EXCEPTION 'No personnel record linked to this account';
  END IF;

  v_key   := private._banking_key();
  v_last4 := right(_account, 4);

  UPDATE public.personnel SET
    bank_name                     = btrim(_bank_name),
    bank_account_type             = _account_type,
    bank_routing_number_encrypted = pgp_sym_encrypt(_routing, v_key),
    bank_account_number_encrypted = pgp_sym_encrypt(_account, v_key),
    bank_routing_number           = _routing,   -- dual-write until follow-up migration drops these
    bank_account_number           = _account,
    bank_account_last4            = v_last4,
    banking_info_updated_at       = now(),
    banking_info_updated_by       = auth.uid(),
    updated_at                    = now()
   WHERE id = v_personnel_id;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.audit_logs(
    user_id, user_email, action_type, resource_type, resource_id, changes_after, success
  ) VALUES (
    auth.uid(),
    COALESCE(v_email, ''),
    'update',
    'personnel_banking',
    v_personnel_id,
    jsonb_build_object(
      'bank_name',          btrim(_bank_name),
      'bank_account_type',  _account_type,
      'bank_account_last4', v_last4
    ),
    true
  );

  RETURN jsonb_build_object(
    'success',            true,
    'bank_account_last4', v_last4
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_my_banking_info(text, text, text, text) TO authenticated;

-- ============================================================
-- 4. Admin/accounting read RPC (payroll, PDF generation)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_personnel_banking(_personnel_id uuid)
RETURNS TABLE(
  bank_name               text,
  bank_account_type       text,
  bank_routing_number     text,
  bank_account_number     text,
  bank_account_last4      text,
  banking_info_updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  IF NOT (
       public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accounting'::app_role)
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_key := private._banking_key();

  RETURN QUERY
  SELECT
    p.bank_name,
    p.bank_account_type,
    COALESCE(
      CASE WHEN p.bank_routing_number_encrypted IS NOT NULL
           THEN pgp_sym_decrypt(p.bank_routing_number_encrypted, v_key)
      END,
      p.bank_routing_number
    ) AS bank_routing_number,
    COALESCE(
      CASE WHEN p.bank_account_number_encrypted IS NOT NULL
           THEN pgp_sym_decrypt(p.bank_account_number_encrypted, v_key)
      END,
      p.bank_account_number
    ) AS bank_account_number,
    COALESCE(p.bank_account_last4, right(p.bank_account_number, 4)) AS bank_account_last4,
    p.banking_info_updated_at
  FROM public.personnel p
  WHERE p.id = _personnel_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_personnel_banking(uuid) TO authenticated;
