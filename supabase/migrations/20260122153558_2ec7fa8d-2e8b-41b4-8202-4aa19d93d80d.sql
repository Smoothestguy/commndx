-- Drop older overloaded versions of complete_personnel_onboarding to prevent function resolution issues
-- Keep only the latest 28-argument version

-- Drop the 16-arg version (oldest, no banking fields)
DROP FUNCTION IF EXISTS public.complete_personnel_onboarding(
  text, uuid, text, text, text, text, date, text, text, text, text, text, text, text, text, jsonb
);

-- Drop the 27-arg version (missing p_documents)
DROP FUNCTION IF EXISTS public.complete_personnel_onboarding(
  text, uuid, text, text, text, text, date, text, text, text, text, text, text, text, text, jsonb,
  text, text, text, text, text, text, text, text, text, boolean, text
);