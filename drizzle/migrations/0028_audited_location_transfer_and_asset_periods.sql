CREATE OR REPLACE FUNCTION public.correct_asset_placement_dates(p_assignment_id uuid, p_start_at timestamptz, p_end_at timestamptz, p_reason text, p_expected_updated_at timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.asset_assignments%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Managers only'; END IF;
 SELECT * INTO a FROM public.asset_assignments WHERE id=p_assignment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Placement not found'; END IF;
 IF a.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Placement changed; reload before editing'; END IF;
 IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'A correction reason is required'; END IF;
 IF p_start_at IS NULL OR (p_end_at IS NOT NULL AND p_end_at<=p_start_at) THEN RAISE EXCEPTION 'Departure must follow arrival'; END IF;
 IF (a.end_at IS NOT NULL OR a.status<>'active') AND p_end_at IS NULL THEN RAISE EXCEPTION 'Ended placements must keep a departure date'; END IF;
 PERFORM 1 FROM public.assets WHERE id=a.asset_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.asset_assignments x WHERE x.asset_id=a.asset_id AND x.id<>a.id AND tstzrange(x.start_at,coalesce(x.end_at,x.unassigned_at),'[)') && tstzrange(p_start_at,p_end_at,'[)')) THEN RAISE EXCEPTION 'These dates overlap another placement'; END IF;
 UPDATE public.asset_assignments SET start_at=p_start_at,end_at=p_end_at WHERE id=a.id;
 INSERT INTO public.audit_logs(user_id,action_type,resource_type,resource_id,changes_before,changes_after,metadata) VALUES(auth.uid(),'update','asset_assignment',a.id,jsonb_build_object('start_at',a.start_at,'end_at',a.end_at),jsonb_build_object('start_at',p_start_at,'end_at',p_end_at),jsonb_build_object('reason',trim(p_reason),'operation','placement_date_correction'));
END $$;
REVOKE ALL ON FUNCTION public.correct_asset_placement_dates(uuid,timestamptz,timestamptz,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.correct_asset_placement_dates(uuid,timestamptz,timestamptz,text,timestamptz) TO authenticated;
CREATE OR REPLACE FUNCTION public.move_location_project(p_location_id uuid,p_target_project_id uuid,p_expected_project_id uuid,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE loc public.project_locations%ROWTYPE; tbl record; n integer; counts jsonb='{}'; person record; original public.personnel_project_assignments%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Managers only'; END IF;
 IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'A move reason is required'; END IF;
 PERFORM 1 FROM public.projects WHERE id IN (p_target_project_id,p_expected_project_id) ORDER BY id FOR UPDATE;
 SELECT * INTO loc FROM public.project_locations WHERE id=p_location_id FOR UPDATE;
 IF NOT FOUND OR loc.project_id IS DISTINCT FROM p_expected_project_id THEN RAISE EXCEPTION 'Location changed; reload before moving'; END IF;
 IF loc.project_id=p_target_project_id THEN RAISE EXCEPTION 'Choose another project'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=p_target_project_id AND deleted_at IS NULL AND archived_at IS NULL AND status='active' AND closed_at IS NULL) THEN RAISE EXCEPTION 'Destination project must be active'; END IF;
 IF EXISTS(SELECT 1 FROM public.time_entries t WHERE (t.location_id=loc.id OR t.visit_personnel_id IN (SELECT vp.id FROM public.visit_personnel vp JOIN public.location_visits lv ON lv.id=vp.visit_id WHERE lv.location_id=loc.id)) AND (t.is_locked OR t.week_closeout_id IS NOT NULL OR t.invoice_id IS NOT NULL OR t.vendor_bill_id IS NOT NULL OR t.job_order_id IS NOT NULL)) THEN RAISE EXCEPTION 'Reopen locked weeks and resolve linked financial entries before moving this location'; END IF;
 IF EXISTS(SELECT 1 FROM public.document_locations dl JOIN public.project_locations other ON other.id=dl.location_id WHERE dl.document_id IN (SELECT document_id FROM public.document_locations WHERE location_id=loc.id) AND other.id<>loc.id AND other.project_id<>p_target_project_id) THEN RAISE EXCEPTION 'A document is shared with another project location; separate that document link before moving'; END IF;
 -- Location IDs and all private originals/version paths stay unchanged.
 UPDATE public.project_locations SET project_id=p_target_project_id,updated_at=now() WHERE id=loc.id;
 -- Discover every base table with both denormalized keys, including future additions.
 FOR tbl IN SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name WHERE c.table_schema='public' AND c.column_name='location_id' AND t.table_type='BASE TABLE' AND EXISTS(SELECT 1 FROM information_schema.columns p WHERE p.table_schema='public' AND p.table_name=c.table_name AND p.column_name='project_id') LOOP
  EXECUTE format('UPDATE public.%I SET project_id=$1 WHERE location_id=$2 AND project_id IS DISTINCT FROM $1',tbl.table_name) USING p_target_project_id,loc.id;
  GET DIAGNOSTICS n=ROW_COUNT; counts=counts||jsonb_build_object(tbl.table_name,n);
 END LOOP;
 UPDATE public.time_entries SET project_id=p_target_project_id WHERE visit_personnel_id IN (SELECT vp.id FROM public.visit_personnel vp JOIN public.location_visits lv ON lv.id=vp.visit_id WHERE lv.location_id=loc.id) AND project_id IS DISTINCT FROM p_target_project_id;
 UPDATE public.project_documents SET project_id=p_target_project_id WHERE id IN (SELECT document_id FROM public.document_locations WHERE location_id=loc.id UNION SELECT document_id FROM public.location_task_orders WHERE location_id=loc.id UNION SELECT document_id FROM public.signin_sheet_days WHERE location_id=loc.id) AND project_id=loc.project_id;
 -- A project-wide status has no location key: carry it only for people exclusive to this location.
 UPDATE public.personnel_status_log s SET project_id=p_target_project_id WHERE s.project_id=loc.project_id AND s.personnel_id IN (SELECT personnel_id FROM public.location_assignments WHERE location_id=loc.id) AND NOT EXISTS(SELECT 1 FROM public.location_assignments a JOIN public.project_locations l ON l.id=a.location_id WHERE a.personnel_id=s.personnel_id AND l.project_id=loc.project_id);
 -- Add destination work eligibility without rewriting source-project engagements or rates.
 FOR person IN SELECT * FROM public.location_assignments WHERE location_id=loc.id AND status='active' AND unassigned_at IS NULL LOOP
  IF NOT EXISTS(SELECT 1 FROM public.personnel_project_assignments WHERE project_id=p_target_project_id AND personnel_id=person.personnel_id AND status='active') THEN
   INSERT INTO public.personnel_project_assignments(personnel_id,project_id,assigned_by,assigned_at,work_classification) VALUES(person.personnel_id,p_target_project_id,auth.uid(),person.assigned_at,person.role_label);
  END IF;
 END LOOP;
 INSERT INTO public.audit_logs(user_id,action_type,resource_type,resource_id,changes_before,changes_after,metadata) VALUES(auth.uid(),'update','project_location',loc.id,jsonb_build_object('project_id',loc.project_id),jsonb_build_object('project_id',p_target_project_id),jsonb_build_object('operation','move_location_project','reason',trim(p_reason),'updated_rows',counts));
 RETURN jsonb_build_object('location_id',loc.id,'project_id',p_target_project_id,'updated_rows',counts);
END $$;
REVOKE ALL ON FUNCTION public.move_location_project(uuid,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.move_location_project(uuid,uuid,uuid,text) TO authenticated;