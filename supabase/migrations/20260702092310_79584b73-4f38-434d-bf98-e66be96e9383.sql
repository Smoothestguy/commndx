
CREATE TABLE IF NOT EXISTS public.application_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  job_posting_id uuid REFERENCES public.job_postings(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  phone text,
  email text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, job_posting_id)
);

CREATE INDEX IF NOT EXISTS application_attempts_phone_idx ON public.application_attempts (phone);
CREATE INDEX IF NOT EXISTS application_attempts_email_idx ON public.application_attempts (lower(email));
CREATE INDEX IF NOT EXISTS application_attempts_updated_at_idx ON public.application_attempts (updated_at DESC);

GRANT SELECT ON public.application_attempts TO authenticated;
GRANT ALL ON public.application_attempts TO service_role;

ALTER TABLE public.application_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view application attempts"
  ON public.application_attempts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can manage application attempts"
  ON public.application_attempts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_application_attempts_updated_at
  BEFORE UPDATE ON public.application_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public upsert function: anon can save/refresh their own attempt, cannot read others'.
CREATE OR REPLACE FUNCTION public.save_application_attempt(
  _session_id text,
  _job_posting_id uuid,
  _first_name text,
  _last_name text,
  _phone text,
  _email text,
  _user_agent text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _session_id IS NULL OR length(_session_id) < 8 OR length(_session_id) > 100 THEN
    RAISE EXCEPTION 'invalid session id';
  END IF;

  -- Require at least one meaningful field
  IF COALESCE(nullif(trim(_first_name), ''), nullif(trim(_last_name), ''),
              nullif(trim(_phone), ''),      nullif(trim(_email), '')) IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.application_attempts AS aa
    (session_id, job_posting_id, first_name, last_name, phone, email, user_agent)
  VALUES
    (_session_id, _job_posting_id,
     nullif(trim(_first_name), ''),
     nullif(trim(_last_name),  ''),
     nullif(trim(_phone),      ''),
     nullif(trim(_email),      ''),
     nullif(trim(_user_agent), ''))
  ON CONFLICT (session_id, job_posting_id) DO UPDATE
     SET first_name = COALESCE(EXCLUDED.first_name, aa.first_name),
         last_name  = COALESCE(EXCLUDED.last_name,  aa.last_name),
         phone      = COALESCE(EXCLUDED.phone,      aa.phone),
         email      = COALESCE(EXCLUDED.email,      aa.email),
         user_agent = COALESCE(EXCLUDED.user_agent, aa.user_agent),
         updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_application_attempt(text, uuid, text, text, text, text, text) TO anon, authenticated;
