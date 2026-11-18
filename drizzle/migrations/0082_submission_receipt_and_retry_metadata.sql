ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS intake_receipt_at timestamptz;
DO $$ DECLARE d text; BEGIN
SELECT pg_get_functiondef('public.submit_public_application(uuid,jsonb,jsonb,uuid)'::regprocedure) INTO d;
d:=replace(d,'; target uuid;',';');
d:=replace(d,' FOR target IN SELECT NULL::uuid WHERE false LOOP END LOOP;','');
d:=replace(d,'submitted_at=stamp,client_submitted_at=stamp,intake_token=', 'submitted_at=now(),client_submitted_at=stamp,intake_receipt_at=now(),geo_lat=coalesce((p_submission#>>''{geo,lat}'')::double precision,geo_lat),geo_lng=coalesce((p_submission#>>''{geo,lng}'')::double precision,geo_lng),geo_accuracy=coalesce((p_submission#>>''{geo,accuracy}'')::double precision,geo_accuracy),geo_source=coalesce(p_submission#>>''{geo,source}'',geo_source),geo_captured_at=coalesce((p_submission#>>''{geo,capturedAt}'')::timestamptz,geo_captured_at),geo_error=p_submission#>>''{geo,error}'',user_agent=coalesce(p_submission->>''userAgent'',user_agent),sms_consent=coalesce((p_submission->>''smsConsent'')::boolean,sms_consent),sms_consent_phone=coalesce(p_submission->>''smsConsentPhone'',sms_consent_phone),sms_consent_at=CASE WHEN coalesce((p_submission->>''smsConsent'')::boolean,false) THEN now() ELSE sms_consent_at END,sms_consent_text_version=coalesce(p_submission->>''smsConsentTextVersion'',sms_consent_text_version),intake_token=');
d:=replace(d,'SELECT * INTO app FROM public.applications WHERE id=next_id; created:=true;', 'UPDATE public.applications SET intake_receipt_at=now() WHERE id=next_id RETURNING * INTO app; created:=true;');
EXECUTE d;
SELECT pg_get_functiondef('public.record_applicant_intake_secure(uuid,uuid,jsonb)'::regprocedure) INTO d;
d:=replace(d,'created_at>now()-interval ''30 minutes''','coalesce(intake_receipt_at,created_at)>now()-interval ''30 minutes''');
EXECUTE d;
END $$;
REVOKE ALL ON FUNCTION public.submit_public_application(uuid,jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_application(uuid,jsonb,jsonb,uuid) TO service_role;