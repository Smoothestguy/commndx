-- 1. Application events instrumentation ------------------------------------
CREATE TABLE public.application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  job_posting_id uuid,
  form_template_id uuid,
  event_type text NOT NULL,
  stage text,
  field_id text,
  field_label text,
  error_code text,
  message text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_application_events_posting_created ON public.application_events (job_posting_id, created_at DESC);
CREATE INDEX idx_application_events_type_created ON public.application_events (event_type, created_at DESC);
CREATE INDEX idx_application_events_session ON public.application_events (session_id, created_at DESC);

GRANT SELECT ON public.application_events TO authenticated;
GRANT ALL ON public.application_events TO service_role;

ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can read application events"
ON public.application_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE OR REPLACE FUNCTION public.log_application_event(
  _session_id text,
  _job_posting_id uuid,
  _event_type text,
  _stage text DEFAULT NULL,
  _field_id text DEFAULT NULL,
  _field_label text DEFAULT NULL,
  _error_code text DEFAULT NULL,
  _message text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recent int;
  _id uuid;
  _template uuid;
BEGIN
  IF _session_id IS NULL OR length(_session_id) = 0 OR length(_session_id) > 100 THEN
    RETURN NULL;
  END IF;
  IF _event_type IS NULL OR length(_event_type) > 60 THEN
    RETURN NULL;
  END IF;

  -- Rate limit: 60 rows per session per hour
  SELECT count(*) INTO _recent
  FROM public.application_events
  WHERE session_id = _session_id
    AND created_at > now() - interval '1 hour';
  IF _recent >= 60 THEN
    RETURN NULL;
  END IF;

  SELECT form_template_id INTO _template
  FROM public.job_postings WHERE id = _job_posting_id;

  INSERT INTO public.application_events (
    session_id, job_posting_id, form_template_id, event_type, stage,
    field_id, field_label, error_code, message, user_agent
  ) VALUES (
    _session_id, _job_posting_id, _template, _event_type, left(_stage, 60),
    left(_field_id, 120), left(_field_label, 200), left(_error_code, 60),
    left(_message, 500), left(_user_agent, 300)
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_application_event(text, uuid, text, text, text, text, text, text, text) TO anon, authenticated;

-- 2. Watchdog storage --------------------------------------------------------
CREATE TABLE public.watchdog_settings (
  id int PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  auto_fix_enabled boolean NOT NULL DEFAULT true,
  auto_recovery_sms_enabled boolean NOT NULL DEFAULT true,
  alert_phone text,
  alert_email text,
  cooldown_hours int NOT NULL DEFAULT 24,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watchdog_settings_singleton CHECK (id = 1)
);

INSERT INTO public.watchdog_settings (id) VALUES (1);

CREATE TABLE public.watchdog_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id uuid,
  form_template_id uuid,
  signature text NOT NULL,
  event_type text,
  stage text,
  field_id text,
  error_code text,
  sample_message text,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  event_count int NOT NULL DEFAULT 0,
  session_count int NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','auto_fixed','escalated','resolved','ignored')),
  diagnosis text,
  recommended_action jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_watchdog_incidents_active_signature
ON public.watchdog_incidents (job_posting_id, signature, status)
WHERE status IN ('open','auto_fixed','escalated');

CREATE INDEX idx_watchdog_incidents_status ON public.watchdog_incidents (status, last_seen DESC);

CREATE TABLE public.watchdog_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES public.watchdog_incidents(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target jsonb,
  before jsonb,
  after jsonb,
  performed_by text NOT NULL DEFAULT 'watchdog',
  undone_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_watchdog_actions_incident ON public.watchdog_actions (incident_id, created_at DESC);
CREATE INDEX idx_watchdog_actions_created ON public.watchdog_actions (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchdog_settings TO authenticated;
GRANT ALL ON public.watchdog_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchdog_incidents TO authenticated;
GRANT ALL ON public.watchdog_incidents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchdog_actions TO authenticated;
GRANT ALL ON public.watchdog_actions TO service_role;

ALTER TABLE public.watchdog_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchdog_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchdog_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers manage watchdog settings"
ON public.watchdog_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers manage watchdog incidents"
ON public.watchdog_incidents FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers manage watchdog actions"
ON public.watchdog_actions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_watchdog_settings_updated_at
BEFORE UPDATE ON public.watchdog_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_watchdog_incidents_updated_at
BEFORE UPDATE ON public.watchdog_incidents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
