CREATE OR REPLACE FUNCTION public.record_applicant_intake_secure(p_application uuid,p_receipt uuid,p_intake jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE person_id uuid; i jsonb:=COALESCE(p_intake,'{}'); photo text:=i->>'photo_url'; BEGIN
 IF octet_length(i::text)>8000 OR i->>'gender' NOT IN ('male','female') THEN RAISE EXCEPTION 'Invalid intake'; END IF;
 IF photo IS NOT NULL AND (photo !~ '^https://' OR length(photo)>2000 OR NOT COALESCE((i->>'photo_consent')::boolean,false)) THEN RAISE EXCEPTION 'Photo consent required'; END IF;
 SELECT applicant_id INTO person_id FROM public.applications WHERE id=p_application AND intake_token=p_receipt AND created_at>now()-interval '30 minutes';
 IF person_id IS NULL THEN RAISE EXCEPTION 'Invalid submission receipt' USING ERRCODE='42501'; END IF;
 UPDATE public.applicants SET gender=coalesce(i->>'gender',gender),photo_url=coalesce(photo,photo_url),sms_consent_at=CASE WHEN COALESCE((i->>'sms_consent')::boolean,false) THEN now() ELSE sms_consent_at END,sms_consent_version=CASE WHEN COALESCE((i->>'sms_consent')::boolean,false) THEN left(i->>'sms_version',40) ELSE sms_consent_version END,photo_consent_at=CASE WHEN COALESCE((i->>'photo_consent')::boolean,false) THEN now() ELSE photo_consent_at END,photo_consent_version=CASE WHEN COALESCE((i->>'photo_consent')::boolean,false) THEN left(i->>'photo_version',40) ELSE photo_consent_version END,consent_language=coalesce(left(i->>'language',10),consent_language),updated_at=now() WHERE id=person_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_applicant_intake_secure(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_applicant_intake_secure(uuid,uuid,jsonb) TO anon,authenticated,service_role;
DO $$ DECLARE f record; d text; BEGIN
 SELECT p.oid INTO f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='confirm_quick_apply';
 d:=pg_get_functiondef(f.oid);
 d:=replace(d,'''application_id'', v_app_id);','''application_id'', v_app_id, ''intake_token'', (SELECT intake_token FROM public.applications WHERE id=v_app_id));');
 EXECUTE d;
END $$;