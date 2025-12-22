-- Add direct deposit information
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS bank_account_type text;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS bank_routing_number text;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS bank_account_number text;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS direct_deposit_signed_at timestamptz;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS direct_deposit_signature text;

-- Add W-9 tax information
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS tax_classification text;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS tax_ein text;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS tax_business_name text;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS w9_signed_at timestamptz;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS w9_signature text;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS w9_certification boolean DEFAULT false;

-- Add Independent Contractor Agreement tracking
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS ica_signed_at timestamptz;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS ica_signature text;

-- Update the complete_personnel_onboarding function to accept new fields
CREATE OR REPLACE FUNCTION public.complete_personnel_onboarding(
  p_token text,
  p_personnel_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip text DEFAULT NULL,
  p_ssn_full text DEFAULT NULL,
  p_citizenship_status text DEFAULT NULL,
  p_immigration_status text DEFAULT NULL,
  p_emergency_contacts jsonb DEFAULT '[]'::jsonb,
  p_bank_name text DEFAULT NULL,
  p_bank_account_type text DEFAULT NULL,
  p_bank_routing_number text DEFAULT NULL,
  p_bank_account_number text DEFAULT NULL,
  p_direct_deposit_signature text DEFAULT NULL,
  p_tax_classification text DEFAULT NULL,
  p_tax_ein text DEFAULT NULL,
  p_tax_business_name text DEFAULT NULL,
  p_w9_signature text DEFAULT NULL,
  p_w9_certification boolean DEFAULT false,
  p_ica_signature text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record RECORD;
  v_contact jsonb;
  v_current_time timestamptz := now();
BEGIN
  -- Validate the token exists and is not used/expired
  SELECT * INTO v_token_record
  FROM personnel_onboarding_tokens
  WHERE token = p_token
    AND personnel_id = p_personnel_id
    AND used_at IS NULL
    AND expires_at > now();

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid, expired, or already used token'
    );
  END IF;

  -- Update the personnel record with all provided data
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
    citizenship_status = COALESCE(p_citizenship_status, citizenship_status),
    immigration_status = COALESCE(p_immigration_status, immigration_status),
    -- Direct deposit fields
    bank_name = COALESCE(p_bank_name, bank_name),
    bank_account_type = COALESCE(p_bank_account_type, bank_account_type),
    bank_routing_number = COALESCE(p_bank_routing_number, bank_routing_number),
    bank_account_number = COALESCE(p_bank_account_number, bank_account_number),
    direct_deposit_signature = COALESCE(p_direct_deposit_signature, direct_deposit_signature),
    direct_deposit_signed_at = CASE WHEN p_direct_deposit_signature IS NOT NULL THEN v_current_time ELSE direct_deposit_signed_at END,
    -- W-9 fields
    tax_classification = COALESCE(p_tax_classification, tax_classification),
    tax_ein = COALESCE(p_tax_ein, tax_ein),
    tax_business_name = COALESCE(p_tax_business_name, tax_business_name),
    w9_signature = COALESCE(p_w9_signature, w9_signature),
    w9_certification = COALESCE(p_w9_certification, w9_certification),
    w9_signed_at = CASE WHEN p_w9_signature IS NOT NULL THEN v_current_time ELSE w9_signed_at END,
    -- ICA fields
    ica_signature = COALESCE(p_ica_signature, ica_signature),
    ica_signed_at = CASE WHEN p_ica_signature IS NOT NULL THEN v_current_time ELSE ica_signed_at END,
    -- Status fields
    onboarding_status = 'completed',
    onboarding_completed_at = v_current_time,
    updated_at = v_current_time
  WHERE id = p_personnel_id;

  -- Delete existing emergency contacts for this personnel
  DELETE FROM emergency_contacts WHERE personnel_id = p_personnel_id;

  -- Insert new emergency contacts
  FOR v_contact IN SELECT * FROM jsonb_array_elements(p_emergency_contacts)
  LOOP
    INSERT INTO emergency_contacts (
      personnel_id,
      contact_name,
      relationship,
      phone,
      email,
      is_primary
    ) VALUES (
      p_personnel_id,
      v_contact->>'name',
      v_contact->>'relationship',
      v_contact->>'phone',
      v_contact->>'email',
      COALESCE((v_contact->>'is_primary')::boolean, false)
    );
  END LOOP;

  -- Mark the token as used
  UPDATE personnel_onboarding_tokens
  SET used_at = v_current_time
  WHERE id = v_token_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Onboarding completed successfully'
  );
END;
$$;