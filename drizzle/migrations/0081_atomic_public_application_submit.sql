CREATE OR REPLACE FUNCTION public.submit_public_application(p_posting uuid,p_applicant jsonb,p_submission jsonb,p_vendor uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.applicants%ROWTYPE; app public.applications%ROWTYPE; e text:=lower(btrim(p_applicant->>'email')); ph text:=regexp_replace(coalesce(p_applicant->>'phone',''),'[^0-9]','','g'); existing boolean:=false; created boolean:=false; next_id uuid; target uuid; stamp timestamptz:=coalesce((p_submission->>'clientSubmittedAt')::timestamptz,now());
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Secure submission required' USING ERRCODE='42501'; END IF;
 IF e IS NULL OR e='' OR nullif(btrim(p_applicant->>'first_name'),'') IS NULL OR nullif(btrim(p_applicant->>'last_name'),'') IS NULL THEN RAISE EXCEPTION 'Invalid application' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.job_postings WHERE id=p_posting AND is_open) THEN RAISE EXCEPTION 'Posting unavailable' USING ERRCODE='22023'; END IF;
 IF length(ph)=11 AND left(ph,1)='1' THEN ph:=substr(ph,2); END IF;
 -- Ordered contact locks serialize retries and either-contact matches without locking unrelated applicants.
 FOR target IN SELECT NULL::uuid WHERE false LOOP END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended(k,0)) FROM (SELECT 'email:'||e AS k UNION SELECT 'phone:'||ph WHERE length(ph)>=10) keys ORDER BY k;
 SELECT * INTO a FROM public.applicants WHERE lower(btrim(email))=e OR (length(ph)>=10 AND CASE WHEN length(regexp_replace(coalesce(phone,''),'[^0-9]','','g'))=11 AND left(regexp_replace(coalesce(phone,''),'[^0-9]','','g'),1)='1' THEN substr(regexp_replace(coalesce(phone,''),'[^0-9]','','g'),2) ELSE regexp_replace(coalesce(phone,''),'[^0-9]','','g') END=ph) ORDER BY (lower(btrim(email))=e) DESC,created_at,id LIMIT 1 FOR UPDATE;
 existing:=FOUND;
 IF existing THEN
  WHILE a.merged_into_id IS NOT NULL LOOP
   SELECT * INTO a FROM public.applicants WHERE id=a.merged_into_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Applicant unavailable'; END IF;
  END LOOP;
  -- Contact fields may change; names/address/photo only fill blanks. No staff-managed fields are accepted.
  UPDATE public.applicants SET email=e,phone=coalesce(nullif(ph,''),phone),first_name=coalesce(nullif(btrim(first_name),''),btrim(p_applicant->>'first_name')),last_name=coalesce(nullif(btrim(last_name),''),btrim(p_applicant->>'last_name')),address=coalesce(nullif(btrim(address),''),nullif(btrim(p_applicant->>'address'),'')),city=coalesce(nullif(btrim(city),''),nullif(btrim(p_applicant->>'city'),'')),state=coalesce(nullif(btrim(state),''),nullif(btrim(p_applicant->>'state'),'')),home_zip=coalesce(nullif(btrim(home_zip),''),nullif(btrim(p_applicant->>'home_zip'),'')),photo_url=coalesce(nullif(photo_url,''),nullif(p_applicant->>'photo_url','')) WHERE id=a.id;
 ELSE
  INSERT INTO public.applicants(first_name,last_name,email,phone,address,city,state,home_zip,photo_url,vendor_id) VALUES(btrim(p_applicant->>'first_name'),btrim(p_applicant->>'last_name'),e,nullif(ph,''),nullif(btrim(p_applicant->>'address'),''),nullif(btrim(p_applicant->>'city'),''),nullif(btrim(p_applicant->>'state'),''),nullif(btrim(p_applicant->>'home_zip'),''),nullif(p_applicant->>'photo_url',''),p_vendor) RETURNING * INTO a;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('application:'||a.id::text||':'||p_posting::text,0));
 SELECT * INTO app FROM public.applications WHERE applicant_id=a.id AND job_posting_id=p_posting ORDER BY created_at DESC,id LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  UPDATE public.applications SET answers=coalesce(answers,'{}'::jsonb)||coalesce(p_submission->'answers','{}'::jsonb),submitted_at=stamp,client_submitted_at=stamp,intake_token=CASE WHEN client_submitted_at IS NOT DISTINCT FROM stamp THEN intake_token ELSE gen_random_uuid() END WHERE id=app.id RETURNING * INTO app;
 ELSE
  next_id:=public.create_application_return_id(p_posting,a.id,coalesce(p_submission->'answers','{}'::jsonb),stamp,(p_submission#>>'{geo,lat}')::double precision,(p_submission#>>'{geo,lng}')::double precision,(p_submission#>>'{geo,accuracy}')::double precision,p_submission#>>'{geo,source}',(p_submission#>>'{geo,capturedAt}')::timestamptz,p_submission#>>'{geo,error}',p_submission->>'userAgent',coalesce((p_submission->>'smsConsent')::boolean,false),p_submission->>'smsConsentPhone',p_submission->>'smsConsentTextVersion');
  SELECT * INTO app FROM public.applications WHERE id=next_id; created:=true;
 END IF;
 RETURN jsonb_build_object('id',app.id,'intake_token',app.intake_token,'agency_retained',existing,'created',created);
END $$;
REVOKE ALL ON FUNCTION public.submit_public_application(uuid,jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_application(uuid,jsonb,jsonb,uuid) TO service_role;