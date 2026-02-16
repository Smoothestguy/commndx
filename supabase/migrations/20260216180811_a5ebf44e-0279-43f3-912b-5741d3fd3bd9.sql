
-- Add work authorization columns to vendors table
ALTER TABLE public.vendors 
  ADD COLUMN IF NOT EXISTS citizenship_status text,
  ADD COLUMN IF NOT EXISTS immigration_status text,
  ADD COLUMN IF NOT EXISTS itin text;

-- Drop and recreate complete_vendor_onboarding with new parameters
DROP FUNCTION IF EXISTS public.complete_vendor_onboarding(text, uuid, text, text, text, text, text, text, text, integer, text, text, text, text, text, text, text, text, boolean, text, text, text, text, text, text, text, numeric);

CREATE OR REPLACE FUNCTION public.complete_vendor_onboarding(
  p_token text,
  p_vendor_id uuid,
  p_name text,
  p_company text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_contact_name text DEFAULT NULL,
  p_contact_title text DEFAULT NULL,
  p_business_type text DEFAULT NULL,
  p_years_in_business integer DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_specialty text DEFAULT NULL,
  p_license_number text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip text DEFAULT NULL,
  p_tax_id text DEFAULT NULL,
  p_track_1099 boolean DEFAULT false,
  p_bank_name text DEFAULT NULL,
  p_bank_account_type text DEFAULT NULL,
  p_bank_routing_number text DEFAULT NULL,
  p_bank_account_number text DEFAULT NULL,
  p_w9_signature text DEFAULT NULL,
  p_vendor_agreement_signature text DEFAULT NULL,
  p_payment_terms text DEFAULT NULL,
  p_billing_rate numeric DEFAULT NULL,
  p_citizenship_status text DEFAULT NULL,
  p_immigration_status text DEFAULT NULL,
  p_itin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token_record RECORD;
  v_current_time TIMESTAMPTZ := now();
BEGIN
  -- Validate the token exists and is not used/expired
  SELECT * INTO v_token_record
  FROM vendor_onboarding_tokens
  WHERE token = p_token
    AND vendor_id = p_vendor_id
    AND used_at IS NULL
    AND expires_at > now();

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid, expired, or already used token'
    );
  END IF;

  -- Update the vendor record with all provided data
  UPDATE vendors SET
    name = COALESCE(p_name, name),
    company = COALESCE(p_company, company),
    email = COALESCE(p_email, email),
    phone = COALESCE(p_phone, phone),
    contact_name = COALESCE(p_contact_name, contact_name),
    contact_title = COALESCE(p_contact_title, contact_title),
    business_type = COALESCE(p_business_type, business_type),
    years_in_business = COALESCE(p_years_in_business, years_in_business),
    website = COALESCE(p_website, website),
    specialty = COALESCE(p_specialty, specialty),
    license_number = COALESCE(p_license_number, license_number),
    address = COALESCE(p_address, address),
    city = COALESCE(p_city, city),
    state = COALESCE(p_state, state),
    zip = COALESCE(p_zip, zip),
    tax_id = COALESCE(p_tax_id, tax_id),
    track_1099 = COALESCE(p_track_1099, track_1099),
    bank_name = COALESCE(p_bank_name, bank_name),
    bank_account_type = COALESCE(p_bank_account_type, bank_account_type),
    bank_routing_number = COALESCE(p_bank_routing_number, bank_routing_number),
    bank_account_number = COALESCE(p_bank_account_number, bank_account_number),
    w9_signature = COALESCE(p_w9_signature, w9_signature),
    w9_signed_at = CASE WHEN p_w9_signature IS NOT NULL THEN v_current_time ELSE w9_signed_at END,
    w9_on_file = CASE WHEN p_w9_signature IS NOT NULL THEN true ELSE w9_on_file END,
    vendor_agreement_signature = COALESCE(p_vendor_agreement_signature, vendor_agreement_signature),
    vendor_agreement_signed_at = CASE WHEN p_vendor_agreement_signature IS NOT NULL THEN v_current_time ELSE vendor_agreement_signed_at END,
    payment_terms = COALESCE(p_payment_terms, payment_terms),
    billing_rate = COALESCE(p_billing_rate, billing_rate),
    citizenship_status = COALESCE(p_citizenship_status, citizenship_status),
    immigration_status = COALESCE(p_immigration_status, immigration_status),
    itin = COALESCE(p_itin, itin),
    onboarding_status = 'completed',
    onboarding_completed_at = v_current_time,
    updated_at = v_current_time
  WHERE id = p_vendor_id;

  -- Mark the token as used
  UPDATE vendor_onboarding_tokens
  SET used_at = v_current_time
  WHERE id = v_token_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Vendor onboarding completed successfully'
  );
END;
$$;
