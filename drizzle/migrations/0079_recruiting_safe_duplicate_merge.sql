ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES public.applicants(id), ADD COLUMN IF NOT EXISTS merged_at timestamptz;
CREATE INDEX IF NOT EXISTS applicants_merged_into_idx ON public.applicants(merged_into_id);
CREATE OR REPLACE FUNCTION public.find_duplicate_applicant_groups()
RETURNS TABLE(group_key text, match_type text, applicant_ids uuid[], names text[], emails text[], phones text[], created_dates date[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'user')) THEN RAISE EXCEPTION 'Recruiting staff required' USING ERRCODE='42501'; END IF;
 RETURN QUERY WITH norm AS (
 SELECT id, first_name||' '||last_name full_name,email,phone,created_at::date cdate,
 nullif(lower(trim(email)),'') n_email,
 nullif(regexp_replace(regexp_replace(coalesce(phone,''),'[^0-9]','','g'),'^1([0-9]{10})$','\1'),'') n_phone,
 nullif(regexp_replace(lower(trim(first_name)),'[^[:alnum:]]','','g'),'')||'|'||nullif(regexp_replace(lower(trim(last_name)),'[^[:alnum:]]','','g'),'') n_name
 FROM public.applicants WHERE status <> 'archived' AND merged_into_id IS NULL), keys AS (
 SELECT n.*,k.mt,k.val FROM norm n CROSS JOIN LATERAL (VALUES ('email',n_email),('phone',CASE WHEN length(n_phone)>=10 THEN n_phone END),('name',n_name)) k(mt,val) WHERE k.val IS NOT NULL)
 SELECT mt||':'||val, mt, array_agg(id ORDER BY cdate,id),array_agg(full_name ORDER BY cdate,id),array_agg(email ORDER BY cdate,id),array_agg(phone ORDER BY cdate,id),array_agg(cdate ORDER BY cdate,id) FROM keys GROUP BY mt,val HAVING count(*)>1;
END $$;
REVOKE ALL ON FUNCTION public.find_duplicate_applicant_groups() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.find_duplicate_applicant_groups() TO authenticated;
CREATE OR REPLACE FUNCTION public.merge_applicants(_keep_id uuid,_merge_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k public.applicants%ROWTYPE; d public.applicants%ROWTYPE; moved jsonb='{}'; n int; c record; merged public.applicants%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Manager or administrator required' USING ERRCODE='42501'; END IF;
 IF _keep_id IS NULL OR _merge_id IS NULL OR _keep_id=_merge_id THEN RAISE EXCEPTION 'Select two different applicants'; END IF;
 PERFORM id FROM public.applicants WHERE id IN (_keep_id,_merge_id) ORDER BY id FOR UPDATE;
 SELECT * INTO k FROM public.applicants WHERE id=_keep_id; IF NOT FOUND THEN RAISE EXCEPTION 'Survivor not found'; END IF;
 SELECT * INTO d FROM public.applicants WHERE id=_merge_id; IF NOT FOUND THEN RAISE EXCEPTION 'Duplicate not found'; END IF;
 IF d.merged_into_id=_keep_id THEN RETURN jsonb_build_object('success',true,'already_merged',true,'kept_id',_keep_id,'merged_id',_merge_id); END IF;
 IF k.status='archived' OR d.status='archived' OR k.merged_into_id IS NOT NULL OR d.merged_into_id IS NOT NULL THEN RAISE EXCEPTION 'Archived or previously merged applicants cannot merge'; END IF;
 IF k.vendor_id IS NOT NULL AND d.vendor_id IS NOT NULL AND k.vendor_id<>d.vendor_id THEN RAISE EXCEPTION 'Different agency employers must be resolved before merging'; END IF;
 UPDATE public.applications SET applicant_id=_keep_id WHERE applicant_id=_merge_id; GET DIAGNOSTICS n=ROW_COUNT; moved=moved||jsonb_build_object('applications',n);
 UPDATE public.personnel SET applicant_id=_keep_id WHERE applicant_id=_merge_id; GET DIAGNOSTICS n=ROW_COUNT; moved=moved||jsonb_build_object('personnel',n);
 UPDATE public.applicant_messages SET applicant_id=_keep_id WHERE applicant_id=_merge_id; GET DIAGNOSTICS n=ROW_COUNT; moved=moved||jsonb_build_object('messages',n);
 UPDATE public.applicant_certifications SET applicant_id=_keep_id WHERE applicant_id=_merge_id; GET DIAGNOSTICS n=ROW_COUNT; moved=moved||jsonb_build_object('certifications',n);
 UPDATE public.quick_apply_invites SET applicant_id=_keep_id WHERE applicant_id=_merge_id;
 UPDATE public.photo_request_tokens SET applicant_id=_keep_id WHERE applicant_id=_merge_id;
 FOR c IN SELECT * FROM public.applicant_capabilities WHERE applicant_id=_merge_id LOOP
   IF EXISTS(SELECT 1 FROM public.applicant_capabilities WHERE applicant_id=_keep_id AND category_id=c.category_id) THEN
     UPDATE public.applicant_capabilities SET years_experience=greatest(years_experience,c.years_experience),evidence=concat_ws(E'\n',nullif(evidence,''),'Merged evidence ['||_merge_id||']: '||coalesce(c.evidence,'')),updated_at=now() WHERE applicant_id=_keep_id AND category_id=c.category_id;
   ELSE UPDATE public.applicant_capabilities SET applicant_id=_keep_id WHERE id=c.id; END IF;
 END LOOP;
 moved=moved||jsonb_build_object('capabilities', (SELECT count(*) FROM public.applicant_capabilities WHERE applicant_id=_keep_id),'application_documents_notes_revisions_events','retained with original application records; unlinked intake events unchanged');
 UPDATE public.applicants SET phone=coalesce(nullif(k.phone,''),d.phone),address=coalesce(nullif(k.address,''),d.address),city=coalesce(nullif(k.city,''),d.city),state=coalesce(nullif(k.state,''),d.state),home_zip=coalesce(nullif(k.home_zip,''),d.home_zip),home_lat=coalesce(k.home_lat,d.home_lat),home_lng=coalesce(k.home_lng,d.home_lng),photo_url=coalesce(nullif(k.photo_url,''),d.photo_url),vendor_id=coalesce(k.vendor_id,d.vendor_id),do_not_rehire=k.do_not_rehire OR d.do_not_rehire,do_not_rehire_reason=concat_ws(E'\n',k.do_not_rehire_reason,d.do_not_rehire_reason),sms_opted_out=k.sms_opted_out OR d.sms_opted_out,role_tags=ARRAY(SELECT DISTINCT unnest(k.role_tags||d.role_tags)),staff_notes=concat_ws(E'\n',nullif(k.staff_notes,''),nullif(d.staff_notes,''),'Merged applicant '||_merge_id||' on '||now()||'; applications moved: '||(moved->>'applications')),updated_at=now() WHERE id=_keep_id;
 UPDATE public.applicants SET status='archived',merged_into_id=_keep_id,merged_at=now(),updated_at=now() WHERE id=_merge_id;
 SELECT * INTO merged FROM public.applicants WHERE id=_keep_id;
 INSERT INTO public.audit_logs(user_id,action_type,resource_type,resource_id,changes_before,changes_after,metadata) VALUES(auth.uid(),'merge','applicant',_keep_id,jsonb_build_object('survivor',to_jsonb(k),'duplicate',to_jsonb(d)),to_jsonb(merged),jsonb_build_object('source_id',_merge_id,'target_id',_keep_id,'records_moved',moved,'duplicate_archived',true));
 RETURN jsonb_build_object('success',true,'kept_id',_keep_id,'merged_id',_merge_id,'applications_moved',(moved->>'applications')::int,'records_moved',moved);
END $$;
REVOKE ALL ON FUNCTION public.merge_applicants(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.merge_applicants(uuid,uuid) TO authenticated;