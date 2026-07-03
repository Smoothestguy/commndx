
-- Master table for one-tap re-apply invites
CREATE TABLE IF NOT EXISTS public.quick_apply_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  job_posting_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
  phone text,
  message text,
  created_by uuid,
  sent_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  used_at timestamptz,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (applicant_id, job_posting_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_apply_invites TO authenticated;
GRANT ALL ON public.quick_apply_invites TO service_role;

ALTER TABLE public.quick_apply_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers manage quick_apply_invites"
ON public.quick_apply_invites
FOR ALL
TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE INDEX IF NOT EXISTS idx_qai_posting ON public.quick_apply_invites(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_qai_applicant ON public.quick_apply_invites(applicant_id);

CREATE TRIGGER trg_qai_updated_at BEFORE UPDATE ON public.quick_apply_invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Batch invite generator (admin/manager only via edge function w/ service role)
CREATE OR REPLACE FUNCTION public.generate_quick_apply_invites(
  _applicant_ids uuid[],
  _job_posting_id uuid,
  _message text DEFAULT NULL,
  _created_by uuid DEFAULT NULL,
  _expires_days integer DEFAULT 14
) RETURNS TABLE(applicant_id uuid, token text, already_applied boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH input AS (
    SELECT unnest(_applicant_ids) AS aid
  ),
  applied AS (
    SELECT DISTINCT a.applicant_id
    FROM public.applications a
    WHERE a.job_posting_id = _job_posting_id
      AND a.status <> 'rejected'
      AND a.applicant_id = ANY(_applicant_ids)
  ),
  upserted AS (
    INSERT INTO public.quick_apply_invites AS q
      (applicant_id, job_posting_id, message, created_by, sent_at, expires_at)
    SELECT i.aid, _job_posting_id, _message, _created_by, now(),
           now() + (COALESCE(_expires_days,14) || ' days')::interval
      FROM input i
     WHERE i.aid NOT IN (SELECT applicant_id FROM applied)
    ON CONFLICT (applicant_id, job_posting_id) DO UPDATE
       SET message   = COALESCE(EXCLUDED.message, q.message),
           sent_at   = now(),
           expires_at= EXCLUDED.expires_at,
           used_at   = NULL,
           updated_at= now()
    RETURNING quick_apply_invites.applicant_id, quick_apply_invites.token
  )
  SELECT i.aid,
         u.token,
         (i.aid IN (SELECT applicant_id FROM applied)) AS already_applied
    FROM input i
    LEFT JOIN upserted u ON u.applicant_id = i.aid;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_quick_apply_invites(uuid[], uuid, text, uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_quick_apply_invites(uuid[], uuid, text, uuid, integer) TO service_role;

-- Public read for token holder (returns nothing without valid unexpired token)
CREATE OR REPLACE FUNCTION public.get_quick_apply_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_already boolean := false;
BEGIN
  SELECT q.id, q.applicant_id, q.job_posting_id, q.expires_at, q.used_at, q.application_id,
         a.first_name, a.last_name, a.email, a.phone, a.photo_url, a.city, a.state, a.home_zip,
         p.public_token, p.is_open,
         pto.title AS task_title,
         pr.name AS project_name, pr.city AS project_city, pr.state AS project_state
    INTO v_row
    FROM public.quick_apply_invites q
    JOIN public.applicants a ON a.id = q.applicant_id
    JOIN public.job_postings p ON p.id = q.job_posting_id
    LEFT JOIN public.project_task_orders pto ON pto.id = p.task_order_id
    LEFT JOIN public.projects pr ON pr.id = pto.project_id
   WHERE q.token = _token
   LIMIT 1;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_row.expires_at < now() AND v_row.used_at IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired', 'public_token', v_row.public_token);
  END IF;

  IF v_row.used_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'valid', true, 'used', true,
      'application_id', v_row.application_id,
      'public_token', v_row.public_token,
      'posting_title', COALESCE(v_row.task_title, v_row.project_name)
    );
  END IF;

  -- Check for existing active application
  SELECT EXISTS(
    SELECT 1 FROM public.applications
    WHERE applicant_id = v_row.applicant_id
      AND job_posting_id = v_row.job_posting_id
      AND status <> 'rejected'
  ) INTO v_already;

  RETURN jsonb_build_object(
    'valid', true,
    'used', false,
    'already_applied', v_already,
    'posting', jsonb_build_object(
      'id', v_row.job_posting_id,
      'public_token', v_row.public_token,
      'is_open', v_row.is_open,
      'title', COALESCE(v_row.task_title, v_row.project_name),
      'project_name', v_row.project_name,
      'project_city', v_row.project_city,
      'project_state', v_row.project_state
    ),
    'applicant', jsonb_build_object(
      'id', v_row.applicant_id,
      'first_name', v_row.first_name,
      'last_name', v_row.last_name,
      'email', v_row.email,
      'phone', v_row.phone,
      'photo_url', v_row.photo_url,
      'city', v_row.city,
      'state', v_row.state,
      'home_zip', v_row.home_zip
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_quick_apply_invite(text) TO anon, authenticated;

-- Confirm the invite — creates the application server-side
CREATE OR REPLACE FUNCTION public.confirm_quick_apply(
  _token text,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_app_id uuid;
BEGIN
  SELECT * INTO v_inv FROM public.quick_apply_invites WHERE token = _token LIMIT 1;
  IF v_inv IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;
  IF v_inv.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_used', true, 'application_id', v_inv.application_id);
  END IF;
  IF v_inv.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  -- Update contact info if user corrected it
  IF _phone IS NOT NULL AND length(trim(_phone)) > 0 THEN
    UPDATE public.applicants SET phone = trim(_phone), updated_at = now() WHERE id = v_inv.applicant_id;
  END IF;
  IF _email IS NOT NULL AND length(trim(_email)) > 0 THEN
    UPDATE public.applicants SET email = lower(trim(_email)), updated_at = now() WHERE id = v_inv.applicant_id;
  END IF;

  -- Reuse existing active application if any
  SELECT id INTO v_app_id
    FROM public.applications
   WHERE applicant_id = v_inv.applicant_id
     AND job_posting_id = v_inv.job_posting_id
     AND status <> 'rejected'
   LIMIT 1;

  IF v_app_id IS NULL THEN
    INSERT INTO public.applications
      (job_posting_id, applicant_id, status, answers, notes, submitted_at, client_submitted_at)
    VALUES
      (v_inv.job_posting_id, v_inv.applicant_id, 'submitted', '{}'::jsonb,
       'quick_apply_invite', now(), now())
    RETURNING id INTO v_app_id;
  END IF;

  UPDATE public.quick_apply_invites
     SET used_at = now(), application_id = v_app_id, updated_at = now()
   WHERE id = v_inv.id;

  RETURN jsonb_build_object('success', true, 'application_id', v_app_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_quick_apply(text, text, text) TO anon, authenticated;
