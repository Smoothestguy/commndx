
CREATE OR REPLACE FUNCTION public.find_applicant_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.applicants WHERE lower(email) = lower(_email) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_applicant_id_by_email(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_active_application_for_posting(_applicant_id uuid, _job_posting_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications
    WHERE applicant_id = _applicant_id
      AND job_posting_id = _job_posting_id
      AND status <> 'rejected'
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_application_for_posting(uuid, uuid) TO anon, authenticated;
