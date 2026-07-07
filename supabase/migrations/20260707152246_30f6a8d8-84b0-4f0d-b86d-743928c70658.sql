
-- 1. Add itin column to personnel
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS itin text;

-- 2. Security-definer RPC to validate onboarding token for anonymous users.
-- Returns only what the onboarding form needs. Distinguishes not_found/expired/used/revoked.
CREATE OR REPLACE FUNCTION public.validate_onboarding_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token RECORD;
  v_personnel RECORD;
  v_answers jsonb := NULL;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) = 0 THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT id, token, personnel_id, expires_at, used_at, revoked_at, created_at
    INTO v_token
  FROM personnel_onboarding_tokens
  WHERE token = p_token
  LIMIT 1;

  IF v_token IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_token.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked', 'expires_at', v_token.expires_at);
  END IF;

  IF v_token.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'used', 'expires_at', v_token.expires_at);
  END IF;

  IF v_token.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired', 'expires_at', v_token.expires_at);
  END IF;

  SELECT id, first_name, last_name, email, phone, date_of_birth,
         address, city, state, zip, photo_url, applicant_id,
         onboarding_status, onboarding_completed_at
    INTO v_personnel
  FROM personnel
  WHERE id = v_token.personnel_id
  LIMIT 1;

  IF v_personnel.applicant_id IS NOT NULL THEN
    SELECT answers INTO v_answers
    FROM applications
    WHERE applicant_id = v_personnel.applicant_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'status', 'valid',
    'token', jsonb_build_object(
      'id', v_token.id,
      'token', v_token.token,
      'personnel_id', v_token.personnel_id,
      'expires_at', v_token.expires_at,
      'used_at', v_token.used_at,
      'created_at', v_token.created_at
    ),
    'personnel', CASE WHEN v_personnel IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_personnel.id,
      'first_name', v_personnel.first_name,
      'last_name', v_personnel.last_name,
      'email', v_personnel.email,
      'phone', v_personnel.phone,
      'date_of_birth', v_personnel.date_of_birth,
      'address', v_personnel.address,
      'city', v_personnel.city,
      'state', v_personnel.state,
      'zip', v_personnel.zip,
      'photo_url', v_personnel.photo_url,
      'applicant_id', v_personnel.applicant_id,
      'onboarding_status', v_personnel.onboarding_status,
      'onboarding_completed_at', v_personnel.onboarding_completed_at
    ) END,
    'application_answers', v_answers
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_onboarding_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_onboarding_token(text) TO anon, authenticated;

-- 3. Drop the broad anon SELECT policies now that RPC replaces them.
DROP POLICY IF EXISTS "Anonymous can view valid onboarding tokens" ON public.personnel_onboarding_tokens;
DROP POLICY IF EXISTS "Anonymous can view personnel with valid onboarding token" ON public.personnel;

-- 4. Rebuild complete_personnel_onboarding to add p_itin and revoked_at guard.
CREATE OR REPLACE FUNCTION public.complete_personnel_onboarding(
  p_token text, p_personnel_id uuid, p_first_name text, p_last_name text, p_email text,
  p_phone text DEFAULT NULL, p_date_of_birth date DEFAULT NULL, p_photo_url text DEFAULT NULL,
  p_address text DEFAULT NULL, p_city text DEFAULT NULL, p_state text DEFAULT NULL, p_zip text DEFAULT NULL,
  p_ssn_full text DEFAULT NULL, p_citizenship_status text DEFAULT NULL, p_immigration_status text DEFAULT NULL,
  p_emergency_contacts jsonb DEFAULT '[]'::jsonb,
  p_bank_name text DEFAULT NULL, p_bank_account_type text DEFAULT NULL,
  p_bank_routing_number text DEFAULT NULL, p_bank_account_number text DEFAULT NULL,
  p_direct_deposit_signature text DEFAULT NULL,
  p_tax_classification text DEFAULT NULL, p_tax_ein text DEFAULT NULL, p_tax_business_name text DEFAULT NULL,
  p_w9_signature text DEFAULT NULL, p_w9_certification boolean DEFAULT false,
  p_ica_signature text DEFAULT NULL,
  p_documents jsonb DEFAULT '[]'::jsonb,
  p_itin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_token_record RECORD;
  v_contact jsonb;
  v_document jsonb;
  v_current_time timestamptz := now();
  v_ssn_last_four TEXT;
  v_name_on_return TEXT;
BEGIN
  SELECT * INTO v_token_record
  FROM personnel_onboarding_tokens
  WHERE token = p_token
    AND personnel_id = p_personnel_id
    AND used_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now();

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid, expired, revoked, or already used token');
  END IF;

  IF (COALESCE(p_bank_name, p_bank_account_number, p_bank_routing_number) IS NOT NULL)
     AND (p_direct_deposit_signature IS NULL OR length(btrim(p_direct_deposit_signature)) = 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Direct Deposit signature is required');
  END IF;
  IF (COALESCE(p_tax_classification, p_ssn_full, p_tax_ein) IS NOT NULL)
     AND (p_w9_signature IS NULL OR length(btrim(p_w9_signature)) = 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'W-9 signature is required');
  END IF;
  IF p_ica_signature IS NULL OR length(btrim(p_ica_signature)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Independent Contractor Agreement signature is required');
  END IF;

  IF p_ssn_full IS NOT NULL AND length(p_ssn_full) >= 4 THEN
    v_ssn_last_four := right(p_ssn_full, 4);
  END IF;

  v_name_on_return := p_first_name || ' ' || p_last_name;

  UPDATE personnel SET
    first_name = p_first_name,
    last_name = p_last_name,
    email = p_email,
    phone = COALESCE(p_phone, phone),
    date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
    photo_url = COALESCE(p_photo_url, photo_url),
    address = COALESCE(p_address, address),
    city = COALESCE(p_city, city),
    state = COALESCE(p_state, state),
    zip = COALESCE(p_zip, zip),
    ssn_full = COALESCE(p_ssn_full, ssn_full),
    ssn_last_four = COALESCE(v_ssn_last_four, ssn_last_four),
    itin = COALESCE(p_itin, itin),
    citizenship_status = COALESCE(p_citizenship_status, citizenship_status),
    immigration_status = COALESCE(p_immigration_status, immigration_status),
    bank_name = COALESCE(p_bank_name, bank_name),
    bank_account_type = COALESCE(p_bank_account_type, bank_account_type),
    bank_routing_number = COALESCE(p_bank_routing_number, bank_routing_number),
    bank_account_number = COALESCE(p_bank_account_number, bank_account_number),
    direct_deposit_signature = COALESCE(p_direct_deposit_signature, direct_deposit_signature),
    direct_deposit_signed_at = CASE WHEN p_direct_deposit_signature IS NOT NULL THEN v_current_time ELSE direct_deposit_signed_at END,
    tax_classification = COALESCE(p_tax_classification, tax_classification),
    tax_ein = COALESCE(p_tax_ein, tax_ein),
    tax_business_name = COALESCE(p_tax_business_name, tax_business_name),
    w9_signature = COALESCE(p_w9_signature, w9_signature),
    w9_certification = COALESCE(p_w9_certification, w9_certification),
    w9_signed_at = CASE WHEN p_w9_signature IS NOT NULL THEN v_current_time ELSE w9_signed_at END,
    ica_signature = COALESCE(p_ica_signature, ica_signature),
    ica_signed_at = CASE WHEN p_ica_signature IS NOT NULL THEN v_current_time ELSE ica_signed_at END,
    onboarding_status = 'completed',
    onboarding_completed_at = v_current_time,
    updated_at = v_current_time
  WHERE id = p_personnel_id;

  DELETE FROM emergency_contacts WHERE personnel_id = p_personnel_id;

  FOR v_contact IN SELECT * FROM jsonb_array_elements(p_emergency_contacts)
  LOOP
    INSERT INTO emergency_contacts (personnel_id, contact_name, relationship, phone, email, is_primary)
    VALUES (p_personnel_id, v_contact->>'name', v_contact->>'relationship', v_contact->>'phone', v_contact->>'email', COALESCE((v_contact->>'is_primary')::boolean, false));
  END LOOP;

  FOR v_document IN SELECT * FROM jsonb_array_elements(p_documents)
  LOOP
    INSERT INTO personnel_documents (personnel_id, document_type, file_name, file_path, file_type, file_size, uploaded_at)
    VALUES (p_personnel_id, v_document->>'type', v_document->>'name', v_document->>'path', v_document->>'fileType', COALESCE((v_document->>'fileSize')::bigint, 0), v_current_time);
  END LOOP;

  DELETE FROM personnel_w9_forms WHERE personnel_id = p_personnel_id;

  IF p_w9_signature IS NOT NULL AND p_tax_classification IS NOT NULL THEN
    INSERT INTO personnel_w9_forms (
      personnel_id, name_on_return, business_name, federal_tax_classification,
      address, city, state, zip, tin_type, ein, signature_data, signature_date,
      certified_us_person, certified_correct_tin, certified_not_subject_backup_withholding,
      certified_fatca_exempt, status, created_at, updated_at
    ) VALUES (
      p_personnel_id, v_name_on_return, p_tax_business_name, p_tax_classification,
      COALESCE(p_address, ''), COALESCE(p_city, ''), COALESCE(p_state, ''), COALESCE(p_zip, ''),
      CASE WHEN p_tax_ein IS NOT NULL AND p_tax_ein != '' THEN 'ein'
           WHEN p_itin IS NOT NULL AND p_itin != '' THEN 'itin'
           ELSE 'ssn' END,
      COALESCE(p_tax_ein, p_itin), p_w9_signature, v_current_time::date,
      true, p_w9_certification, true, false, 'completed', v_current_time, v_current_time
    );
  END IF;

  UPDATE personnel_onboarding_tokens SET used_at = v_current_time WHERE id = v_token_record.id;

  RETURN jsonb_build_object('success', true, 'message', 'Onboarding completed successfully');
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_personnel_onboarding(
  text, uuid, text, text, text, text, date, text, text, text, text, text,
  text, text, text, jsonb, text, text, text, text, text, text, text, text,
  text, boolean, text, jsonb, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_personnel_onboarding(
  text, uuid, text, text, text, text, date, text, text, text, text, text,
  text, text, text, jsonb, text, text, text, text, text, text, text, text,
  text, boolean, text, jsonb, text
) TO anon, authenticated;
