-- Create vendor onboarding tokens table (similar to personnel_onboarding_tokens)
CREATE TABLE public.vendor_onboarding_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  token TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(token)
);

-- Enable RLS
ALTER TABLE public.vendor_onboarding_tokens ENABLE ROW LEVEL SECURITY;

-- Public read policy for token validation (unauthenticated access for onboarding)
CREATE POLICY "Allow public read for onboarding validation"
ON public.vendor_onboarding_tokens
FOR SELECT
TO anon, authenticated
USING (true);

-- Admin/manager can manage tokens
CREATE POLICY "Admins and managers can manage onboarding tokens"
ON public.vendor_onboarding_tokens
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Add onboarding status fields to vendors table
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'invited', 'in_progress', 'completed', 'approved')),
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS business_type TEXT,
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS contact_title TEXT,
ADD COLUMN IF NOT EXISTS years_in_business INTEGER,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_type TEXT,
ADD COLUMN IF NOT EXISTS bank_routing_number TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS w9_signature TEXT,
ADD COLUMN IF NOT EXISTS w9_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS vendor_agreement_signature TEXT,
ADD COLUMN IF NOT EXISTS vendor_agreement_signed_at TIMESTAMPTZ;

-- Create vendor_onboarding_documents table for uploaded documents
CREATE TABLE public.vendor_onboarding_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  expiry_date DATE,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_onboarding_documents ENABLE ROW LEVEL SECURITY;

-- Public can insert documents during onboarding (validated by token on backend)
CREATE POLICY "Allow public insert for onboarding documents"
ON public.vendor_onboarding_documents
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Authenticated users can view documents
CREATE POLICY "Authenticated users can view vendor documents"
ON public.vendor_onboarding_documents
FOR SELECT
TO authenticated
USING (true);

-- Admins/managers can manage documents
CREATE POLICY "Admins and managers can manage vendor documents"
ON public.vendor_onboarding_documents
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Vendors can view their own documents
CREATE POLICY "Vendors can view their own documents"
ON public.vendor_onboarding_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendors 
    WHERE vendors.id = vendor_onboarding_documents.vendor_id 
    AND vendors.user_id = auth.uid()
  )
);

-- Create function to complete vendor onboarding
CREATE OR REPLACE FUNCTION public.complete_vendor_onboarding(
  p_token TEXT,
  p_vendor_id UUID,
  -- Company info
  p_name TEXT,
  p_company TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_contact_name TEXT DEFAULT NULL,
  p_contact_title TEXT DEFAULT NULL,
  p_business_type TEXT DEFAULT NULL,
  p_years_in_business INTEGER DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_specialty TEXT DEFAULT NULL,
  p_license_number TEXT DEFAULT NULL,
  -- Address
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_zip TEXT DEFAULT NULL,
  -- Tax info
  p_tax_id TEXT DEFAULT NULL,
  p_track_1099 BOOLEAN DEFAULT false,
  -- Banking
  p_bank_name TEXT DEFAULT NULL,
  p_bank_account_type TEXT DEFAULT NULL,
  p_bank_routing_number TEXT DEFAULT NULL,
  p_bank_account_number TEXT DEFAULT NULL,
  -- W9
  p_w9_signature TEXT DEFAULT NULL,
  -- Vendor agreement
  p_vendor_agreement_signature TEXT DEFAULT NULL,
  -- Payment terms
  p_payment_terms TEXT DEFAULT NULL,
  p_billing_rate NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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