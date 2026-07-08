
-- Update applicant profile on submit — only overwrite empty/null fields with non-empty inputs.
CREATE OR REPLACE FUNCTION public.update_applicant_profile_on_submit(
  _applicant_id uuid,
  _first_name text DEFAULT NULL,
  _last_name text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL,
  _home_zip text DEFAULT NULL,
  _photo_url text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.applicants SET
    first_name = CASE WHEN _first_name IS NOT NULL AND length(btrim(_first_name)) > 0 THEN _first_name ELSE first_name END,
    last_name  = CASE WHEN _last_name  IS NOT NULL AND length(btrim(_last_name))  > 0 THEN _last_name  ELSE last_name  END,
    phone      = CASE WHEN _phone      IS NOT NULL AND length(btrim(_phone))      > 0 THEN _phone      ELSE phone      END,
    address    = CASE WHEN _address    IS NOT NULL AND length(btrim(_address))    > 0 THEN _address    ELSE address    END,
    city       = CASE WHEN _city       IS NOT NULL AND length(btrim(_city))       > 0 THEN _city       ELSE city       END,
    state      = CASE WHEN _state      IS NOT NULL AND length(btrim(_state))      > 0 THEN _state      ELSE state      END,
    home_zip   = CASE WHEN _home_zip   IS NOT NULL AND length(btrim(_home_zip))   > 0 THEN _home_zip   ELSE home_zip   END,
    photo_url  = CASE WHEN _photo_url  IS NOT NULL AND length(btrim(_photo_url))  > 0 THEN _photo_url  ELSE photo_url  END,
    updated_at = now()
  WHERE id = _applicant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_applicant_profile_on_submit(uuid,text,text,text,text,text,text,text,text) TO anon, authenticated;

-- Resubmit an existing non-rejected application for a given applicant + posting.
CREATE OR REPLACE FUNCTION public.resubmit_application(
  _job_posting_id uuid,
  _applicant_id uuid,
  _answers jsonb DEFAULT '{}'::jsonb,
  _client_submitted_at timestamptz DEFAULT NULL,
  _geo_lat double precision DEFAULT NULL,
  _geo_lng double precision DEFAULT NULL,
  _geo_accuracy double precision DEFAULT NULL,
  _geo_source text DEFAULT NULL,
  _geo_captured_at timestamptz DEFAULT NULL,
  _geo_error text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _sms_consent boolean DEFAULT false,
  _sms_consent_phone text DEFAULT NULL,
  _sms_consent_text_version text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app_id uuid;
  v_now timestamptz := now();
  v_note_line text;
BEGIN
  SELECT id INTO v_app_id
  FROM public.applications
  WHERE applicant_id = _applicant_id
    AND job_posting_id = _job_posting_id
    AND status <> 'rejected'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_app_id IS NULL THEN
    RAISE EXCEPTION 'No active application to resubmit for this applicant and posting';
  END IF;

  v_note_line := 'Resubmitted ' || to_char(v_now, 'YYYY-MM-DD HH24:MI:SS TZ') || ' — previous answers replaced.';

  UPDATE public.applications SET
    answers = COALESCE(_answers, '{}'::jsonb),
    submitted_at = v_now,
    client_submitted_at = COALESCE(_client_submitted_at, v_now),
    geo_lat = _geo_lat,
    geo_lng = _geo_lng,
    geo_accuracy = _geo_accuracy,
    geo_source = _geo_source,
    geo_captured_at = _geo_captured_at,
    geo_error = _geo_error,
    user_agent = _user_agent,
    sms_consent = COALESCE(_sms_consent, false),
    sms_consent_phone = CASE WHEN _sms_consent THEN _sms_consent_phone ELSE sms_consent_phone END,
    sms_consent_at = CASE WHEN _sms_consent THEN v_now ELSE sms_consent_at END,
    sms_consent_text_version = CASE WHEN _sms_consent THEN COALESCE(_sms_consent_text_version, 'v1.0') ELSE sms_consent_text_version END,
    status = 'updated',
    notes = CASE
      WHEN notes IS NULL OR length(btrim(notes)) = 0 THEN v_note_line
      ELSE notes || E'\n' || v_note_line
    END,
    updated_at = v_now
  WHERE id = v_app_id;

  RETURN v_app_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resubmit_application(uuid,uuid,jsonb,timestamptz,double precision,double precision,double precision,text,timestamptz,text,text,boolean,text,text) TO anon, authenticated;
