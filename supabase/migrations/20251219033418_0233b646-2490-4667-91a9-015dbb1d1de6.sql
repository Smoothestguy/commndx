-- Create personnel onboarding tokens table
CREATE TABLE public.personnel_onboarding_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.personnel_onboarding_tokens ENABLE ROW LEVEL SECURITY;

-- Policy for admins/managers to view tokens
CREATE POLICY "Admins and managers can view onboarding tokens"
ON public.personnel_onboarding_tokens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- Policy for public token validation (for onboarding page)
CREATE POLICY "Anyone can validate tokens for onboarding"
ON public.personnel_onboarding_tokens
FOR SELECT
USING (true);

-- Policy for edge functions to insert tokens (using service role)
CREATE POLICY "Service role can insert tokens"
ON public.personnel_onboarding_tokens
FOR INSERT
WITH CHECK (true);

-- Policy for updating tokens (mark as used)
CREATE POLICY "Service role can update tokens"
ON public.personnel_onboarding_tokens
FOR UPDATE
USING (true);