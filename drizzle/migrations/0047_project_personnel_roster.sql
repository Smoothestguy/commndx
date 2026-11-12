ALTER TABLE public.personnel_project_assignments ADD COLUMN active boolean NOT NULL DEFAULT true, ADD COLUMN added_by uuid, ADD COLUMN added_at timestamptz NOT NULL DEFAULT now();
UPDATE public.personnel_project_assignments SET active=(status='active'), added_by=assigned_by, added_at=assigned_at;
ALTER POLICY "Admins and managers can manage personnel assignments" ON public.personnel_project_assignments WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
REVOKE ALL ON public.personnel_project_assignments FROM anon;
CREATE OR REPLACE FUNCTION public.stamp_project_personnel_roster() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='INSERT' THEN NEW.active := NEW.status='active'; NEW.added_by:=coalesce(auth.uid(),NEW.assigned_by); NEW.added_at:=now();
 ELSE
 IF NEW.active IS DISTINCT FROM OLD.active AND NEW.status IS NOT DISTINCT FROM OLD.status THEN NEW.status:=CASE WHEN NEW.active THEN 'active' ELSE 'unassigned' END; END IF;
 NEW.active:=NEW.status='active'; NEW.added_by:=OLD.added_by; NEW.added_at:=OLD.added_at;
 IF OLD.active AND NOT NEW.active THEN NEW.unassigned_at:=coalesce(NEW.unassigned_at,now()); NEW.unassigned_by:=auth.uid(); END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER stamp_project_personnel_roster BEFORE INSERT OR UPDATE ON public.personnel_project_assignments FOR EACH ROW EXECUTE FUNCTION public.stamp_project_personnel_roster();
WITH used AS (
 SELECT l.project_id,a.personnel_id,min(coalesce(a.assigned_at,now())) AS first_at FROM public.location_assignments a JOIN public.project_locations l ON l.id=a.location_id WHERE a.status='active' GROUP BY l.project_id,a.personnel_id
 UNION ALL SELECT l.project_id,p.personnel_id,min(v.check_in_at) FROM public.visit_personnel p JOIN public.location_visits v ON v.id=p.visit_id JOIN public.project_locations l ON l.id=v.location_id GROUP BY l.project_id,p.personnel_id
 UNION ALL SELECT project_id,personnel_id,min(entry_date::timestamptz) FROM public.time_entries WHERE project_id IS NOT NULL AND personnel_id IS NOT NULL GROUP BY project_id,personnel_id
), dedup AS (SELECT project_id,personnel_id,min(first_at) first_at FROM used GROUP BY project_id,personnel_id)
INSERT INTO public.personnel_project_assignments(project_id,personnel_id,assigned_at,status) SELECT d.project_id,d.personnel_id,coalesce(d.first_at,now()),'active' FROM dedup d WHERE NOT EXISTS(SELECT 1 FROM public.personnel_project_assignments a WHERE a.project_id=d.project_id AND a.personnel_id=d.personnel_id AND a.status='active');
CREATE OR REPLACE FUNCTION public.project_personnel_roster(p_project uuid) RETURNS TABLE(id uuid,assignment_id uuid,first_name text,last_name text,status text,vendor_id uuid,employer_customer_id uuid,non_billable boolean,on_bench boolean,bench_rank integer,added_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'accounting')) THEN RAISE EXCEPTION 'Staff access required'; END IF;
 RETURN QUERY SELECT p.id,a.id,p.first_name,p.last_name,p.status::text,p.vendor_id,p.employer_customer_id,p.non_billable,p.on_bench,p.bench_rank,a.added_at FROM public.personnel_project_assignments a JOIN public.personnel p ON p.id=a.personnel_id WHERE a.project_id=p_project AND a.active AND a.status='active' AND p.deleted_at IS NULL AND p.merged_into_id IS NULL ORDER BY p.first_name,p.last_name;
 END $$;
REVOKE ALL ON FUNCTION public.project_personnel_roster(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_personnel_roster(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.set_project_personnel_roster(p_project uuid,p_person uuid,p_active boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_id uuid; BEGIN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Manager access required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_project::text||p_person::text,0));
 SELECT id INTO v_id FROM public.personnel_project_assignments WHERE project_id=p_project AND personnel_id=p_person AND status='active' FOR UPDATE;
 IF p_active THEN
 IF v_id IS NULL THEN INSERT INTO public.personnel_project_assignments(project_id,personnel_id,assigned_by) VALUES(p_project,p_person,auth.uid()) RETURNING id INTO v_id; END IF;
 ELSE UPDATE public.personnel_project_assignments SET active=false,unassigned_reason='Removed from project roster' WHERE id=v_id; END IF;
 INSERT INTO public.audit_logs(user_id,user_email,action,resource_type,resource_id,details) VALUES(auth.uid(),coalesce((SELECT email FROM public.profiles WHERE id=auth.uid()),'system'),CASE WHEN p_active THEN 'create' ELSE 'update' END,'project_personnel_roster',v_id::text,jsonb_build_object('project_id',p_project,'personnel_id',p_person,'active',p_active));
 RETURN v_id; END $$;
REVOKE ALL ON FUNCTION public.set_project_personnel_roster(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_project_personnel_roster(uuid,uuid,boolean) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.stamp_project_personnel_roster() FROM PUBLIC,anon,authenticated;