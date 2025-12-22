-- Create personnel_documents table to store uploaded documents during onboarding
CREATE TABLE public.personnel_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'government_id', 'ssn_card', 'work_permit', 'i94', etc.
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.personnel_documents ENABLE ROW LEVEL SECURITY;

-- Admins and managers can manage all personnel documents
CREATE POLICY "Admins and managers can manage personnel documents"
  ON public.personnel_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Personnel can view their own documents
CREATE POLICY "Personnel can view own documents"
  ON public.personnel_documents FOR SELECT
  USING (personnel_id = get_personnel_id_for_user(auth.uid()));

-- Service role can insert documents (for onboarding completion)
CREATE POLICY "Service role can insert documents"
  ON public.personnel_documents FOR INSERT
  WITH CHECK (true);

-- Create index for faster lookups by personnel_id
CREATE INDEX idx_personnel_documents_personnel_id ON public.personnel_documents(personnel_id);

-- Update the complete_personnel_onboarding function to handle documents
CREATE OR REPLACE FUNCTION public.complete_personnel_onboarding(
  p_token text, 
  p_personnel_id uuid, 
  p_first_name text, 
  p_last_name text, 
  p_email text, 
  p_phone text DEFAULT NULL::text, 
  p_date_of_birth date DEFAULT NULL::date, 
  p_photo_url text DEFAULT NULL::text, 
  p_address text DEFAULT NULL::text, 
  p_city text DEFAULT NULL::text, 
  p_state text DEFAULT NULL::text, 
  p_zip text DEFAULT NULL::text, 
  p_ssn_full text DEFAULT NULL::text, 
  p_citizenship_status text DEFAULT NULL::text, 
  p_immigration_status text DEFAULT NULL::text, 
  p_emergency_contacts jsonb DEFAULT '[]'::jsonb,
  p_bank_name text DEFAULT NULL::text,
  p_bank_account_type text DEFAULT NULL::text,
  p_bank_routing_number text DEFAULT NULL::text,
  p_bank_account_number text DEFAULT NULL::text,
  p_direct_deposit_signature text DEFAULT NULL::text,
  p_tax_classification text DEFAULT NULL::text,
  p_tax_ein text DEFAULT NULL::text,
  p_tax_business_name text DEFAULT NULL::text,
  p_w9_signature text DEFAULT NULL::text,
  p_w9_certification boolean DEFAULT false,
  p_ica_signature text DEFAULT NULL::text,
  p_documents jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token_record RECORD;
  v_contact jsonb;
  v_document jsonb;
  v_current_time timestamptz := now();
  v_ssn_last_four TEXT;
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

  -- Calculate SSN last four if provided
  IF p_ssn_full IS NOT NULL AND length(p_ssn_full) >= 4 THEN
    v_ssn_last_four := right(p_ssn_full, 4);
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
    ssn_last_four = COALESCE(v_ssn_last_four, ssn_last_four),
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

  -- Insert documents
  FOR v_document IN SELECT * FROM jsonb_array_elements(p_documents)
  LOOP
    INSERT INTO personnel_documents (
      personnel_id,
      document_type,
      file_name,
      file_path,
      file_type,
      file_size,
      uploaded_at
    ) VALUES (
      p_personnel_id,
      v_document->>'type',
      v_document->>'name',
      v_document->>'path',
      v_document->>'fileType',
      COALESCE((v_document->>'fileSize')::bigint, 0),
      v_current_time
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
$function$;