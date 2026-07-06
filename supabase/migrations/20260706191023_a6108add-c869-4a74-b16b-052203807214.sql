CREATE POLICY "Anonymous can view valid onboarding tokens"
ON public.personnel_onboarding_tokens
FOR SELECT
TO anon
USING (
  used_at IS NULL
  AND revoked_at IS NULL
  AND expires_at > now()
);

GRANT SELECT ON public.personnel_onboarding_tokens TO anon;