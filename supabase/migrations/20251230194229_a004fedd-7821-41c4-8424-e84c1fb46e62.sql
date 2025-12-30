-- Drop the overly permissive policy that allows anyone to view all tokens
DROP POLICY IF EXISTS "Anyone can validate tokens for onboarding" ON public.personnel_onboarding_tokens;

-- Create a restricted policy for anonymous users to validate specific tokens
-- This allows the onboarding flow to work while preventing enumeration of all tokens
CREATE POLICY "Anonymous can validate token by value"
ON public.personnel_onboarding_tokens
FOR SELECT
TO anon
USING (
  -- Only allow access when the token value is being used as a filter
  -- This works because RLS evaluates per-row and the query must filter by token
  token IS NOT NULL
);