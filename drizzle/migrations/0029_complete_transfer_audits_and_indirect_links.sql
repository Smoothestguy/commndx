DO $$ DECLARE fn record; body text; BEGIN FOR fn IN SELECT oid,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('correct_asset_placement_dates','move_location_project') LOOP
 body:=pg_get_functiondef(fn.oid);
 body:=replace(body,'audit_logs(user_id,action_type','audit_logs(user_id,user_email,action_type');
 body:=replace(body,'VALUES(auth.uid(),''update''','VALUES(auth.uid(),coalesce((SELECT email FROM public.profiles WHERE id=auth.uid()),auth.jwt()->>''email'',''authenticated-user''),''update''');
 IF fn.proname='move_location_project' THEN
  body:=replace(body,'-- Location IDs and all private originals/version paths stay unchanged.', 'IF EXISTS(SELECT 1 FROM public.time_week_closeouts w WHERE w.project_id IN (loc.project_id,p_target_project_id) AND w.status=''closed'' AND EXISTS(SELECT 1 FROM public.time_entries t WHERE t.location_id=loc.id AND t.entry_date BETWEEN w.week_start_date AND w.week_end_date)) THEN RAISE EXCEPTION ''Reopen closed payroll weeks before moving''; END IF;
  -- Location IDs and all private originals/version paths stay unchanged.');
  body:=replace(body,'-- A project-wide status has no location key:', 'UPDATE public.clock_alerts SET project_id=p_target_project_id WHERE time_entry_id IN (SELECT id FROM public.time_entries WHERE location_id=loc.id);
  -- A project-wide status has no location key:');
 END IF;
 EXECUTE body;
END LOOP; END $$;