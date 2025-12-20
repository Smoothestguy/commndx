-- Enable pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add merge tracking columns to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES public.customers(id),
ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS merged_by UUID,
ADD COLUMN IF NOT EXISTS merge_reason TEXT;

-- Add merge tracking columns to vendors table
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES public.vendors(id),
ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS merged_by UUID,
ADD COLUMN IF NOT EXISTS merge_reason TEXT;

-- Add merge tracking columns to personnel table (already has status for is_active)
ALTER TABLE public.personnel 
ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES public.personnel(id),
ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS merged_by UUID,
ADD COLUMN IF NOT EXISTS merge_reason TEXT;

-- Create entity merge audit table for complete audit trail
CREATE TABLE public.entity_merge_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('customer', 'vendor', 'personnel')),
  source_entity_id UUID NOT NULL,
  target_entity_id UUID NOT NULL,
  source_entity_snapshot JSONB NOT NULL,
  target_entity_snapshot JSONB NOT NULL,
  merged_entity_snapshot JSONB NOT NULL,
  field_overrides JSONB DEFAULT '{}',
  related_records_updated JSONB DEFAULT '{}',
  quickbooks_resolution JSONB,
  merged_at TIMESTAMPTZ DEFAULT now(),
  merged_by UUID,
  merged_by_email TEXT,
  notes TEXT,
  is_reversed BOOLEAN DEFAULT false,
  reversed_at TIMESTAMPTZ,
  reversed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient lookups
CREATE INDEX idx_entity_merge_audit_source ON public.entity_merge_audit(entity_type, source_entity_id);
CREATE INDEX idx_entity_merge_audit_target ON public.entity_merge_audit(entity_type, target_entity_id);
CREATE INDEX idx_entity_merge_audit_merged_at ON public.entity_merge_audit(merged_at DESC);

-- Create indexes for merge tracking on entity tables
CREATE INDEX IF NOT EXISTS idx_customers_merged_into ON public.customers(merged_into_id) WHERE merged_into_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_merged_into ON public.vendors(merged_into_id) WHERE merged_into_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personnel_merged_into ON public.personnel(merged_into_id) WHERE merged_into_id IS NOT NULL;

-- Enable RLS on entity_merge_audit
ALTER TABLE public.entity_merge_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view merge audit records
CREATE POLICY "Admins can view merge audit records"
ON public.entity_merge_audit
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Only admins can insert merge audit records
CREATE POLICY "Admins can insert merge audit records"
ON public.entity_merge_audit
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Function to find duplicate customers
CREATE OR REPLACE FUNCTION public.find_duplicate_customers(p_customer_id UUID)
RETURNS TABLE (
  duplicate_id UUID,
  duplicate_name TEXT,
  duplicate_email TEXT,
  duplicate_phone TEXT,
  duplicate_company TEXT,
  match_type TEXT,
  match_score INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH source AS (
    SELECT * FROM customers WHERE id = p_customer_id
  )
  SELECT DISTINCT ON (c.id)
    c.id,
    c.name,
    c.email,
    c.phone,
    c.company,
    CASE 
      WHEN c.email = s.email AND c.email IS NOT NULL AND c.email != '' THEN 'email'
      WHEN c.phone = s.phone AND c.phone IS NOT NULL AND c.phone != '' THEN 'phone'
      WHEN LOWER(TRIM(c.name)) = LOWER(TRIM(s.name)) AND LOWER(COALESCE(c.company, '')) = LOWER(COALESCE(s.company, '')) THEN 'name_company'
      ELSE 'fuzzy'
    END as match_type,
    CASE 
      WHEN c.email = s.email AND c.email IS NOT NULL AND c.email != '' THEN 100
      WHEN c.phone = s.phone AND c.phone IS NOT NULL AND c.phone != '' THEN 90
      WHEN LOWER(TRIM(c.name)) = LOWER(TRIM(s.name)) THEN 80
      ELSE 60
    END as match_score
  FROM customers c, source s
  WHERE c.id != p_customer_id
    AND c.merged_into_id IS NULL
    AND (
      (c.email = s.email AND c.email IS NOT NULL AND c.email != '')
      OR (c.phone = s.phone AND c.phone IS NOT NULL AND c.phone != '')
      OR (LOWER(TRIM(c.name)) = LOWER(TRIM(s.name)) AND LOWER(COALESCE(c.company, '')) = LOWER(COALESCE(s.company, '')))
      OR similarity(c.name, s.name) > 0.6
    )
  ORDER BY c.id, 
    CASE 
      WHEN c.email = s.email THEN 1
      WHEN c.phone = s.phone THEN 2
      WHEN LOWER(TRIM(c.name)) = LOWER(TRIM(s.name)) THEN 3
      ELSE 4
    END;
END;
$$;

-- Function to find duplicate vendors
CREATE OR REPLACE FUNCTION public.find_duplicate_vendors(p_vendor_id UUID)
RETURNS TABLE (
  duplicate_id UUID,
  duplicate_name TEXT,
  duplicate_email TEXT,
  duplicate_phone TEXT,
  duplicate_company TEXT,
  duplicate_tax_id TEXT,
  match_type TEXT,
  match_score INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH source AS (
    SELECT * FROM vendors WHERE id = p_vendor_id
  )
  SELECT DISTINCT ON (v.id)
    v.id,
    v.name,
    v.email,
    v.phone,
    v.company,
    v.tax_id,
    CASE 
      WHEN v.tax_id = s.tax_id AND v.tax_id IS NOT NULL AND v.tax_id != '' THEN 'tax_id'
      WHEN v.email = s.email AND v.email IS NOT NULL AND v.email != '' THEN 'email'
      WHEN v.phone = s.phone AND v.phone IS NOT NULL AND v.phone != '' THEN 'phone'
      WHEN LOWER(TRIM(v.name)) = LOWER(TRIM(s.name)) AND LOWER(COALESCE(v.company, '')) = LOWER(COALESCE(s.company, '')) THEN 'name_company'
      ELSE 'fuzzy'
    END as match_type,
    CASE 
      WHEN v.tax_id = s.tax_id AND v.tax_id IS NOT NULL AND v.tax_id != '' THEN 100
      WHEN v.email = s.email AND v.email IS NOT NULL AND v.email != '' THEN 95
      WHEN v.phone = s.phone AND v.phone IS NOT NULL AND v.phone != '' THEN 90
      WHEN LOWER(TRIM(v.name)) = LOWER(TRIM(s.name)) THEN 80
      ELSE 60
    END as match_score
  FROM vendors v, source s
  WHERE v.id != p_vendor_id
    AND (v.is_active IS NULL OR v.is_active = true)
    AND v.merged_into_id IS NULL
    AND (
      (v.tax_id = s.tax_id AND v.tax_id IS NOT NULL AND v.tax_id != '')
      OR (v.email = s.email AND v.email IS NOT NULL AND v.email != '')
      OR (v.phone = s.phone AND v.phone IS NOT NULL AND v.phone != '')
      OR (LOWER(TRIM(v.name)) = LOWER(TRIM(s.name)) AND LOWER(COALESCE(v.company, '')) = LOWER(COALESCE(s.company, '')))
      OR similarity(v.name, s.name) > 0.6
    )
  ORDER BY v.id,
    CASE 
      WHEN v.tax_id = s.tax_id THEN 1
      WHEN v.email = s.email THEN 2
      WHEN v.phone = s.phone THEN 3
      ELSE 4
    END;
END;
$$;

-- Function to find duplicate personnel
CREATE OR REPLACE FUNCTION public.find_duplicate_personnel(p_personnel_id UUID)
RETURNS TABLE (
  duplicate_id UUID,
  duplicate_name TEXT,
  duplicate_email TEXT,
  duplicate_phone TEXT,
  duplicate_ssn_last_four TEXT,
  match_type TEXT,
  match_score INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH source AS (
    SELECT * FROM personnel WHERE id = p_personnel_id
  )
  SELECT DISTINCT ON (p.id)
    p.id,
    p.first_name || ' ' || p.last_name,
    p.email,
    p.phone,
    p.ssn_last_four,
    CASE 
      WHEN p.ssn_last_four = s.ssn_last_four AND p.ssn_last_four IS NOT NULL AND p.ssn_last_four != '' THEN 'ssn'
      WHEN p.email = s.email AND p.email IS NOT NULL AND p.email != '' THEN 'email'
      WHEN p.phone = s.phone AND p.phone IS NOT NULL AND p.phone != '' THEN 'phone'
      WHEN LOWER(TRIM(p.first_name)) = LOWER(TRIM(s.first_name)) AND LOWER(TRIM(p.last_name)) = LOWER(TRIM(s.last_name)) THEN 'name'
      ELSE 'fuzzy'
    END as match_type,
    CASE 
      WHEN p.ssn_last_four = s.ssn_last_four AND p.ssn_last_four IS NOT NULL AND p.ssn_last_four != '' THEN 100
      WHEN p.email = s.email AND p.email IS NOT NULL AND p.email != '' THEN 95
      WHEN p.phone = s.phone AND p.phone IS NOT NULL AND p.phone != '' THEN 90
      WHEN LOWER(TRIM(p.first_name)) = LOWER(TRIM(s.first_name)) AND LOWER(TRIM(p.last_name)) = LOWER(TRIM(s.last_name)) THEN 85
      ELSE 60
    END as match_score
  FROM personnel p, source s
  WHERE p.id != p_personnel_id
    AND p.status != 'inactive'
    AND p.merged_into_id IS NULL
    AND (
      (p.ssn_last_four = s.ssn_last_four AND p.ssn_last_four IS NOT NULL AND p.ssn_last_four != '')
      OR (p.email = s.email AND p.email IS NOT NULL AND p.email != '')
      OR (p.phone = s.phone AND p.phone IS NOT NULL AND p.phone != '')
      OR (LOWER(TRIM(p.first_name)) = LOWER(TRIM(s.first_name)) AND LOWER(TRIM(p.last_name)) = LOWER(TRIM(s.last_name)))
      OR similarity(p.first_name || ' ' || p.last_name, s.first_name || ' ' || s.last_name) > 0.6
    )
  ORDER BY p.id,
    CASE 
      WHEN p.ssn_last_four = s.ssn_last_four THEN 1
      WHEN p.email = s.email THEN 2
      WHEN p.phone = s.phone THEN 3
      ELSE 4
    END;
END;
$$;