ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS intake_token uuid NOT NULL DEFAULT gen_random_uuid();
DO $guard$ DECLARE f record; d text; gate text; BEGIN
 gate := 'IF COALESCE(auth.role(),'''') <> ''service_role'' AND NOT (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''manager'')) THEN RAISE EXCEPTION ''Secure submission required'' USING ERRCODE=''42501''; END IF;';
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('merge_applicants','create_personnel_vendor','update_applicant_geo','resubmit_application','create_applicant_return_id','create_application_return_id','update_applicant_profile_on_submit','record_applicant_intake') LOOP
 d:=pg_get_functiondef(f.oid); d:=regexp_replace(d,'\mBEGIN\M','BEGIN '||gate); EXECUTE d;
 END LOOP;
END $guard$;
CREATE OR REPLACE FUNCTION public.record_applicant_intake_secure(p_application uuid,p_receipt uuid,p_intake jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; i jsonb:=COALESCE(p_intake,'{}'); BEGIN
 IF octet_length(i::text)>8000 THEN RAISE EXCEPTION 'Invalid intake'; END IF;
 SELECT id INTO a FROM public.applications WHERE id=p_application AND intake_token=p_receipt AND created_at>now()-interval '30 minutes';
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid submission receipt' USING ERRCODE='42501'; END IF;
 RETURN public.record_applicant_intake(p_application,i->>'gender',i->>'photo_url',COALESCE((i->>'sms_consent')::boolean,false),i->>'sms_version',COALESCE((i->>'photo_consent')::boolean,false),i->>'photo_version',COALESCE((i->>'background_consent')::boolean,false),i->>'background_version',i->>'language');
END $$;
REVOKE ALL ON FUNCTION public.record_applicant_intake_secure(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_applicant_intake_secure(uuid,uuid,jsonb) TO anon,authenticated,service_role;
DO $telemetry$ DECLARE f record; d text; BEGIN
 FOR f IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('save_application_attempt','log_application_attempt_error','log_application_event') LOOP
 d:=pg_get_functiondef(f.oid);
 d:=regexp_replace(d,'\mBEGIN\M','BEGIN IF NOT EXISTS (SELECT 1 FROM public.job_postings WHERE id=_job_posting_id AND is_open) THEN RETURN'||CASE WHEN f.proname='log_application_event' THEN ' NULL' ELSE '' END||'; END IF;');
 IF f.proname='save_application_attempt' THEN d:=regexp_replace(d,'\mBEGIN\M','BEGIN IF length(COALESCE(_first_name,''''))>100 OR length(COALESCE(_last_name,''''))>100 OR length(COALESCE(_phone,''''))>40 OR length(COALESCE(_email,''''))>255 OR length(COALESCE(_user_agent,''''))>1000 THEN RAISE EXCEPTION ''Input too large''; END IF;'); END IF;
 EXECUTE d;
 END LOOP;
END $telemetry$;
REVOKE INSERT,UPDATE ON public.applicants,public.applications FROM anon;
REVOKE UPDATE ON public.applications FROM authenticated;
GRANT UPDATE ON public.applications TO authenticated;
DROP POLICY IF EXISTS "Public can update applications via edit token" ON public.applications;