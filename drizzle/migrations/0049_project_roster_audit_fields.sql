CREATE OR REPLACE FUNCTION public.set_project_personnel_roster(p_project uuid,p_person uuid,p_active boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_id uuid; BEGIN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Manager access required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_project::text||p_person::text,0));
 SELECT id INTO v_id FROM public.personnel_project_assignments WHERE project_id=p_project AND personnel_id=p_person AND status='active' FOR UPDATE;
 IF p_active THEN
 IF v_id IS NULL THEN INSERT INTO public.personnel_project_assignments(project_id,personnel_id,assigned_by) VALUES(p_project,p_person,auth.uid()) RETURNING id INTO v_id; END IF;
 ELSE UPDATE public.personnel_project_assignments SET active=false,unassigned_reason='Removed from project roster' WHERE id=v_id; END IF;
 IF v_id IS NOT NULL THEN
 INSERT INTO public.audit_logs(user_id,user_email,action_type,resource_type,resource_id,metadata,success) VALUES(auth.uid(),coalesce((SELECT email FROM public.profiles WHERE id=auth.uid()),'system'),CASE WHEN p_active THEN 'create' ELSE 'update' END,'project_personnel_roster',v_id,jsonb_build_object('project_id',p_project,'personnel_id',p_person,'active',p_active),true);
 END IF; RETURN v_id; END $$;