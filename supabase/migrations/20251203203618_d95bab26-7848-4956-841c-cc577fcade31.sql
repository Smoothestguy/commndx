-- Add has_adjuster column to insurance_claims table
ALTER TABLE public.insurance_claims 
ADD COLUMN has_adjuster boolean DEFAULT true;