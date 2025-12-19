-- Create a security definer function to complete personnel onboarding
-- This bypasses RLS policies after validating the onboarding token
CREATE OR REPLACE FUNCTION public.complete_personnel_onboarding(
  p_token TEXT,
  p_personnel_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT NULL,
  p_date_of_birth DATE DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_zip TEXT DEFAULT NULL,
  p_ssn_full TEXT DEFAULT NULL,
  p_citizenship_status TEXT DEFAULT NULL,
  p_immigration_status TEXT DEFAULT NULL,
  p_emergency_contacts JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record RECORD;
  v_contact JSONB;
  v_ssn_last_four TEXT;
BEGIN
  -- 1. Validate the token
  SELECT * INTO v_token_record
  FROM public.personnel_onboarding_tokens
  WHERE token = p_token
    AND personnel_id = p_personnel_id
    AND used_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid, expired, or already used onboarding token'
    );
  END IF;

  -- 2. Calculate SSN last four if provided
  IF p_ssn_full IS NOT NULL AND length(p_ssn_full) >= 4 THEN
    v_ssn_last_four := right(p_ssn_full, 4);
  END IF;

  -- 3. Update the personnel record
  UPDATE public.personnel
  SET 
    first_name = p_first_name,
    last_name = p_last_name,
    email = p_email,
    phone = p_phone,
    date_of_birth = p_date_of_birth,
    photo_url = p_photo_url,
    address = p_address,
    city = p_city,
    state = p_state,
    zip = p_zip,
    ssn_full = p_ssn_full,
    ssn_last_four = v_ssn_last_four,
    citizenship_status = p_citizenship_status,
    immigration_status = p_immigration_status,
    onboarding_status = 'completed',
    onboarding_completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_personnel_id;

  -- 4. Delete existing emergency contacts for this personnel
  DELETE FROM public.emergency_contacts
  WHERE personnel_id = p_personnel_id;

  -- 5. Insert new emergency contacts
  IF jsonb_array_length(p_emergency_contacts) > 0 THEN
    FOR v_contact IN SELECT * FROM jsonb_array_elements(p_emergency_contacts)
    LOOP
      INSERT INTO public.emergency_contacts (
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
        NULLIF(v_contact->>'email', ''),
        COALESCE((v_contact->>'is_primary')::boolean, false)
      );
    END LOOP;
  END IF;

  -- 6. Mark the token as used
  UPDATE public.personnel_onboarding_tokens
  SET used_at = NOW()
  WHERE token = p_token;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Onboarding completed successfully'
  );
END;
$$;