-- Add RLS policy to allow anonymous users to read personnel data
-- when they have a valid, unexpired, unused onboarding token
CREATE POLICY "Anonymous can view personnel with valid onboarding token"
ON public.personnel
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 
    FROM personnel_onboarding_tokens pot
    WHERE pot.personnel_id = personnel.id
      AND pot.used_at IS NULL
      AND pot.revoked_at IS NULL
      AND pot.expires_at > now()
  )
);