CREATE POLICY "Anon can read vendor during onboarding"
ON public.vendors
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_onboarding_tokens
    WHERE vendor_onboarding_tokens.vendor_id = vendors.id
      AND vendor_onboarding_tokens.used_at IS NULL
      AND vendor_onboarding_tokens.expires_at > now()
  )
);