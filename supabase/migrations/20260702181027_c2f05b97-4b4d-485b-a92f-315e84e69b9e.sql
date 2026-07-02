
-- Clean up debug rows from earlier RLS testing
DELETE FROM public.applicants WHERE email LIKE 'rls_%_test@example.com' OR email LIKE 'rls_min_%@example.com' OR email LIKE 'rls_repr_%@example.com' OR email = 'rlscheck_test_9999@example.com' OR email = 'rlscheck_test_888@example.com' OR email = 'rls_min_test@example.com';

-- Security-definer RPC used by public application form.
-- Anon users cannot SELECT from applicants (PII protection), so the
-- .insert().select() pattern from PostgREST fails with an RLS error even
-- though the row was written. This RPC bypasses that by inserting on the
-- caller's behalf and returning only the id.
CREATE OR REPLACE FUNCTION public.create_applicant_return_id(
  _first_name text,
  _last_name text,
  _email text,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL,
  _home_zip text DEFAULT NULL,
  _photo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _first_name IS NULL OR length(trim(_first_name)) = 0
     OR _last_name  IS NULL OR length(trim(_last_name))  = 0
     OR _email      IS NULL OR length(trim(_email))      = 0 THEN
    RAISE EXCEPTION 'first_name, last_name and email are required';
  END IF;

  -- Reuse existing applicant by email (case-insensitive) if present
  SELECT id INTO v_id
  FROM public.applicants
  WHERE lower(email) = lower(_email)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.applicants
    (first_name, last_name, email, phone, address, city, state, home_zip, photo_url, status)
  VALUES
    (trim(_first_name), trim(_last_name), trim(_email),
     nullif(trim(_phone), ''),
     nullif(trim(_address), ''),
     nullif(trim(_city), ''),
     nullif(trim(_state), ''),
     nullif(trim(_home_zip), ''),
     nullif(trim(_photo_url), ''),
     'new')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_applicant_return_id(text,text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_applicant_return_id(text,text,text,text,text,text,text,text,text) TO anon, authenticated;
