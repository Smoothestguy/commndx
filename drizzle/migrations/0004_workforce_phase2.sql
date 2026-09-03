-- Applicant lifecycle flags
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS do_not_rehire boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_rehire_reason text,
  ADD COLUMN IF NOT EXISTS sms_opted_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS available_from date;

ALTER TABLE public.quick_apply_invites
  ADD COLUMN IF NOT EXISTS opened_at timestamptz;

-- Ratings
CREATE TABLE IF NOT EXISTS public.personnel_assignment_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES public.personnel_project_assignments(id) ON DELETE SET NULL,
  rated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  overall int NOT NULL CHECK (overall BETWEEN 1 AND 5),
  reliability int CHECK (reliability BETWEEN 1 AND 5),
  skill int CHECK (skill BETWEEN 1 AND 5),
  attitude int CHECK (attitude BETWEEN 1 AND 5),
  would_rehire boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS personnel_assignment_ratings_unique_rater
  ON public.personnel_assignment_ratings (assignment_id, rated_by)
  WHERE assignment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS personnel_assignment_ratings_personnel_idx
  ON public.personnel_assignment_ratings (personnel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personnel_assignment_ratings TO authenticated;
GRANT ALL ON public.personnel_assignment_ratings TO service_role;
ALTER TABLE public.personnel_assignment_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers manage ratings"
  ON public.personnel_assignment_ratings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated staff can read ratings"
  ON public.personnel_assignment_ratings FOR SELECT TO authenticated
  USING (true);

-- Applicant outbound message log
CREATE TABLE IF NOT EXISTS public.applicant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  job_posting_id uuid REFERENCES public.job_postings(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'sms',
  body text,
  subject text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  twilio_sid text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS applicant_messages_applicant_idx ON public.applicant_messages (applicant_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicant_messages TO authenticated;
GRANT ALL ON public.applicant_messages TO service_role;
ALTER TABLE public.applicant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers manage applicant messages"
  ON public.applicant_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated staff can read applicant messages"
  ON public.applicant_messages FOR SELECT TO authenticated
  USING (true);

-- Rating rollup trigger
CREATE OR REPLACE FUNCTION public.apply_assignment_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _avg numeric;
  _applicant uuid;
BEGIN
  SELECT avg(overall) INTO _avg
  FROM public.personnel_assignment_ratings
  WHERE personnel_id = NEW.personnel_id;

  UPDATE public.personnel SET rating = round(_avg, 2), updated_at = now()
  WHERE id = NEW.personnel_id;

  SELECT applicant_id INTO _applicant FROM public.personnel WHERE id = NEW.personnel_id;

  IF _applicant IS NOT NULL AND NEW.would_rehire = false THEN
    UPDATE public.applicants
      SET do_not_rehire = true,
          do_not_rehire_reason = COALESCE(do_not_rehire_reason, NEW.notes),
          updated_at = now()
    WHERE id = _applicant;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_assignment_rating ON public.personnel_assignment_ratings;
CREATE TRIGGER trg_apply_assignment_rating
AFTER INSERT ON public.personnel_assignment_ratings
FOR EACH ROW EXECUTE FUNCTION public.apply_assignment_rating();

-- Public form: resolve an invite token to minimal prefill data
CREATE OR REPLACE FUNCTION public.get_workforce_invite(_token text)
RETURNS TABLE (first_name text, last_name text, phone text, email text, job_posting_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.first_name, a.last_name, a.phone, a.email, i.job_posting_id
  FROM public.quick_apply_invites i
  JOIN public.applicants a ON a.id = i.applicant_id
  WHERE i.token = _token
    AND i.used_at IS NULL
    AND (i.expires_at IS NULL OR i.expires_at > now())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.mark_workforce_invite_opened(_token text)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.quick_apply_invites
  SET opened_at = COALESCE(opened_at, now()), updated_at = now()
  WHERE token = _token AND used_at IS NULL AND (expires_at IS NULL OR expires_at > now());
$$;

REVOKE ALL ON FUNCTION public.get_workforce_invite(text) FROM public;
REVOKE ALL ON FUNCTION public.mark_workforce_invite_opened(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_workforce_invite(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_workforce_invite_opened(text) TO anon, authenticated, service_role;