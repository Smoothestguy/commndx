
CREATE OR REPLACE FUNCTION public.create_application_return_id(
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
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _job_posting_id IS NULL OR _applicant_id IS NULL THEN
    RAISE EXCEPTION 'job_posting_id and applicant_id are required';
  END IF;

  INSERT INTO public.applications
    (job_posting_id, applicant_id, answers, status,
     submitted_at, client_submitted_at,
     geo_lat, geo_lng, geo_accuracy, geo_source, geo_captured_at, geo_error,
     user_agent,
     sms_consent, sms_consent_phone, sms_consent_at, sms_consent_method, sms_consent_text_version)
  VALUES
    (_job_posting_id, _applicant_id, COALESCE(_answers, '{}'::jsonb), 'submitted',
     now(), _client_submitted_at,
     _geo_lat, _geo_lng, _geo_accuracy, _geo_source, _geo_captured_at, _geo_error,
     _user_agent,
     COALESCE(_sms_consent, false),
     CASE WHEN _sms_consent THEN _sms_consent_phone ELSE NULL END,
     CASE WHEN _sms_consent THEN now() ELSE NULL END,
     CASE WHEN _sms_consent THEN 'web_form' ELSE NULL END,
     CASE WHEN _sms_consent THEN COALESCE(_sms_consent_text_version, 'v1.0') ELSE NULL END)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_application_return_id(uuid,uuid,jsonb,timestamptz,double precision,double precision,double precision,text,timestamptz,text,text,boolean,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_application_return_id(uuid,uuid,jsonb,timestamptz,double precision,double precision,double precision,text,timestamptz,text,text,boolean,text,text) TO anon, authenticated;
