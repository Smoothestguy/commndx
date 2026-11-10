CREATE TABLE public.image_optimizations (bucket_id text NOT NULL, object_path text NOT NULL, thumbnail_path text, original_bytes bigint NOT NULL, optimized_bytes bigint NOT NULL, thumbnail_bytes bigint NOT NULL DEFAULT 0, original_sha256 text NOT NULL, optimized_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(bucket_id,object_path));
GRANT SELECT ON public.image_optimizations TO authenticated;
GRANT ALL ON public.image_optimizations TO service_role;
ALTER TABLE public.image_optimizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY image_optimization_staff ON public.image_optimizations FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TABLE public.archived_purge_exports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, applicant_ids uuid[] NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), purged_at timestamptz);
GRANT ALL ON public.archived_purge_exports TO service_role;
ALTER TABLE public.archived_purge_exports ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public._archived_purge_snapshot(p_ids uuid[]) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT jsonb_build_object('applicants',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM applicants a WHERE a.id=ANY(p_ids)),'[]'::jsonb),'applications',coalesce((SELECT jsonb_agg(to_jsonb(a)-'edit_token'-'edit_token_expires_at' ORDER BY a.id) FROM applications a WHERE a.applicant_id=ANY(p_ids)),'[]'::jsonb),'messages',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM applicant_messages a WHERE a.applicant_id=ANY(p_ids)),'[]'::jsonb),'certifications',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM applicant_certifications a WHERE a.applicant_id=ANY(p_ids)),'[]'::jsonb),'capabilities',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM applicant_capabilities a WHERE a.applicant_id=ANY(p_ids)),'[]'::jsonb)); $$;
REVOKE ALL ON FUNCTION public._archived_purge_snapshot(uuid[]) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.export_archived_applicants() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ids uuid[]; snap jsonb; ticket uuid;
BEGIN
IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Not authorized'; END IF;
SELECT array_agg(id) INTO ids FROM (SELECT a.id FROM applicants a WHERE a.status::text='archived' AND NOT EXISTS (SELECT 1 FROM personnel p WHERE p.applicant_id=a.id) AND NOT EXISTS(SELECT 1 FROM applications ap WHERE ap.applicant_id=a.id AND ap.answers::text ~* '(signature|signed_document|countersign)') ORDER BY a.id LIMIT 500) q;
ids:=coalesce(ids,'{}'::uuid[]); snap:=public._archived_purge_snapshot(ids);
INSERT INTO archived_purge_exports(user_id,applicant_ids,snapshot) VALUES(auth.uid(),ids,snap) RETURNING id INTO ticket;
RETURN jsonb_build_object('export_id',ticket,'count',cardinality(ids),'data',snap);
END $$;
REVOKE ALL ON FUNCTION public.export_archived_applicants() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.export_archived_applicants() TO authenticated;
CREATE OR REPLACE FUNCTION public.purge_archived_applicants(p_export_id uuid,p_confirmation text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.archived_purge_exports; n integer; em text;
BEGIN
IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Not authorized'; END IF;
IF p_confirmation IS DISTINCT FROM 'PURGE' THEN RAISE EXCEPTION 'Type PURGE to confirm'; END IF;
SELECT * INTO e FROM archived_purge_exports WHERE id=p_export_id AND user_id=auth.uid() FOR UPDATE;
IF NOT FOUND OR e.purged_at IS NOT NULL OR e.created_at < now()-interval '30 minutes' THEN RAISE EXCEPTION 'Export expired; export again'; END IF;
PERFORM 1 FROM applicants WHERE id=ANY(e.applicant_ids) FOR UPDATE;
IF EXISTS(SELECT 1 FROM applicants WHERE id=ANY(e.applicant_ids) AND status::text<>'archived') OR EXISTS(SELECT 1 FROM personnel WHERE applicant_id=ANY(e.applicant_ids)) OR public._archived_purge_snapshot(e.applicant_ids) IS DISTINCT FROM e.snapshot THEN RAISE EXCEPTION 'Records changed or linked; export again'; END IF;
DELETE FROM applicants WHERE id=ANY(e.applicant_ids) AND status::text='archived'; GET DIAGNOSTICS n=ROW_COUNT;
UPDATE archived_purge_exports SET purged_at=now(),snapshot='{}'::jsonb WHERE id=e.id;
SELECT email INTO em FROM profiles WHERE id=auth.uid();
INSERT INTO audit_logs(action_type,resource_type,user_id,user_email,success,changes_after) VALUES('delete','archived_applicant_purge',auth.uid(),coalesce(em,'manager'),true,jsonb_build_object('count',n,'export_id',e.id,'applicant_ids',e.applicant_ids));
RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.purge_archived_applicants(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purge_archived_applicants(uuid,text) TO authenticated;