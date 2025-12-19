-- Create personnel_w9_forms table for IRS W-9 form data
CREATE TABLE public.personnel_w9_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  
  -- W-9 Line 1: Name as shown on income tax return
  name_on_return TEXT NOT NULL,
  
  -- W-9 Line 2: Business name/disregarded entity name (if different)
  business_name TEXT,
  
  -- W-9 Line 3: Federal tax classification
  federal_tax_classification TEXT NOT NULL,
  llc_tax_classification TEXT,
  other_classification TEXT,
  
  -- W-9 Line 4: Exemptions
  exempt_payee_code TEXT,
  fatca_exemption_code TEXT,
  
  -- W-9 Lines 5-6: Address
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  
  -- W-9 Line 7: Account numbers (optional)
  account_numbers TEXT,
  
  -- W-9 Part I: Taxpayer Identification Number
  tin_type TEXT NOT NULL DEFAULT 'ssn' CHECK (tin_type IN ('ssn', 'ein')),
  -- Note: We'll use ssn_full from personnel table or store EIN here
  ein TEXT,
  
  -- W-9 Part II: Certification
  signature_data TEXT,
  signature_date DATE NOT NULL,
  certified_us_person BOOLEAN DEFAULT true,
  certified_correct_tin BOOLEAN DEFAULT true,
  certified_not_subject_backup_withholding BOOLEAN DEFAULT true,
  certified_fatca_exempt BOOLEAN DEFAULT false,
  
  -- Document upload (if they upload a signed PDF)
  document_url TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'verified', 'rejected')),
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- One W-9 per personnel
  UNIQUE(personnel_id)
);

-- Enable RLS
ALTER TABLE public.personnel_w9_forms ENABLE ROW LEVEL SECURITY;

-- Personnel can view their own W-9
CREATE POLICY "Personnel can view own W-9" ON public.personnel_w9_forms
  FOR SELECT USING (
    personnel_id = public.get_personnel_id_for_user(auth.uid())
  );

-- Personnel can insert their own W-9
CREATE POLICY "Personnel can insert own W-9" ON public.personnel_w9_forms
  FOR INSERT WITH CHECK (
    personnel_id = public.get_personnel_id_for_user(auth.uid())
  );

-- Personnel can update their own W-9 (only if not yet verified)
CREATE POLICY "Personnel can update own W-9" ON public.personnel_w9_forms
  FOR UPDATE USING (
    personnel_id = public.get_personnel_id_for_user(auth.uid())
    AND status != 'verified'
  );

-- Admins and managers can manage all W-9s
CREATE POLICY "Admins and managers can manage W-9s" ON public.personnel_w9_forms
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
  );

-- Create updated_at trigger
CREATE TRIGGER update_personnel_w9_forms_updated_at
  BEFORE UPDATE ON public.personnel_w9_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_personnel_w9_forms_personnel_id ON public.personnel_w9_forms(personnel_id);
CREATE INDEX idx_personnel_w9_forms_status ON public.personnel_w9_forms(status);