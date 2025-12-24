-- Add revocation tracking to personnel_onboarding_tokens
ALTER TABLE public.personnel_onboarding_tokens 
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS revoke_reason TEXT;

-- Add reverse approval tracking to personnel_registrations
ALTER TABLE public.personnel_registrations
ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reverse_reason TEXT;

-- Create index for finding active tokens
CREATE INDEX IF NOT EXISTS idx_personnel_onboarding_tokens_active 
ON public.personnel_onboarding_tokens (personnel_id) 
WHERE used_at IS NULL AND revoked_at IS NULL;