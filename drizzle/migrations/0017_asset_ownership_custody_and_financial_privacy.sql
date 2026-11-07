ALTER TABLE public.assets ADD COLUMN ownership text NOT NULL DEFAULT 'owned', ADD COLUMN vendor_id uuid REFERENCES public.vendors(id), ADD COLUMN unit_cost numeric, ADD COLUMN rental_rate numeric, ADD COLUMN rental_period text DEFAULT 'day', ADD COLUMN notes text;
ALTER TABLE public.assets ADD CONSTRAINT assets_ownership_valid CHECK (ownership IN ('owned','rented')), ADD CONSTRAINT assets_rental_period_valid CHECK (rental_period IN ('day','week','month')), ADD CONSTRAINT assets_costs_nonnegative CHECK ((unit_cost IS NULL OR unit_cost >= 0) AND (rental_rate IS NULL OR rental_rate >= 0));
CREATE TABLE public.asset_custody_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id uuid NOT NULL REFERENCES public.asset_assignments(id) ON DELETE CASCADE, personnel_id uuid, started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz, changed_by uuid);
GRANT SELECT ON public.asset_custody_history TO authenticated;
GRANT ALL ON public.asset_custody_history TO service_role;
ALTER TABLE public.asset_custody_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read asset custody history" ON public.asset_custody_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
INSERT INTO public.asset_custody_history(assignment_id,personnel_id,started_at,ended_at,changed_by) SELECT id,assigned_to_personnel_id,start_at,COALESCE(end_at,unassigned_at),assigned_by FROM public.asset_assignments WHERE assigned_to_personnel_id IS NOT NULL;
ALTER POLICY "Authenticated users can view non-deleted assets" ON public.assets USING (deleted_at IS NULL AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')));
ALTER POLICY "Authenticated users can view asset assignments" ON public.asset_assignments USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
ALTER POLICY "Admin and Manager can update assets" ON public.assets WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
ALTER POLICY "Admin and Manager can update asset assignments" ON public.asset_assignments WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE FUNCTION public.asset_catalog() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE money boolean; BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
money := public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager');
RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'type',a.type,'label',a.label,'description',a.description,'address',a.address,'gate_code',a.gate_code,'access_instructions',a.access_instructions,'operating_hours',a.operating_hours,'instructions',a.instructions,'serial_number',a.serial_number,'status',a.status,'ownership',a.ownership,'vendor_id',a.vendor_id,'vendor_name',v.name,'created_at',a.created_at,'updated_at',a.updated_at,'deleted_at',a.deleted_at) || CASE WHEN money THEN jsonb_build_object('default_day_rate',a.default_day_rate,'unit_cost',a.unit_cost,'rental_rate',a.rental_rate,'rental_period',a.rental_period,'notes',a.notes,'metadata',a.metadata) ELSE '{}'::jsonb END ORDER BY a.label) FROM public.assets a LEFT JOIN public.vendors v ON v.id=a.vendor_id WHERE a.deleted_at IS NULL),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.asset_catalog() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.asset_catalog() TO authenticated,service_role;
CREATE FUNCTION public.asset_placements(p_project_id uuid DEFAULT NULL,p_personnel_id uuid DEFAULT NULL,p_location_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE money boolean; catalog jsonb; BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
money := public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager');
catalog := public.asset_catalog();
RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',aa.id,'project_id',aa.project_id,'asset_id',aa.asset_id,'location_id',aa.location_id,'assigned_to_personnel_id',aa.assigned_to_personnel_id,'assigned_by',aa.assigned_by,'start_at',aa.start_at,'end_at',aa.end_at,'unassigned_at',aa.unassigned_at,'unassigned_by',aa.unassigned_by,'status',aa.status,'created_at',aa.created_at,'updated_at',aa.updated_at,'assets',a.value,'personnel',CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name) END,'projects',jsonb_build_object('id',pr.id,'name',pr.name)) || CASE WHEN money THEN jsonb_build_object('billable',aa.billable,'day_rate',aa.day_rate,'notes',aa.notes,'unassigned_reason',aa.unassigned_reason,'unassigned_notes',aa.unassigned_notes) ELSE '{}'::jsonb END ORDER BY aa.created_at DESC) FROM public.asset_assignments aa LEFT JOIN LATERAL (SELECT value FROM jsonb_array_elements(catalog) WHERE value->>'id'=aa.asset_id::text) a ON true LEFT JOIN public.personnel p ON p.id=aa.assigned_to_personnel_id LEFT JOIN public.projects pr ON pr.id=aa.project_id WHERE (p_project_id IS NULL OR aa.project_id=p_project_id) AND (p_personnel_id IS NULL OR aa.assigned_to_personnel_id=p_personnel_id) AND (p_location_id IS NULL OR aa.location_id=p_location_id) AND (money OR public.has_role(auth.uid(),'user') OR aa.assigned_to_personnel_id=public.get_personnel_id_for_user(auth.uid()))),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.asset_placements(uuid,uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.asset_placements(uuid,uuid,uuid) TO authenticated,service_role;
CREATE FUNCTION public.track_asset_custody() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE at_time timestamptz := now(); BEGIN
IF TG_OP='UPDATE' AND NEW.assigned_to_personnel_id IS NOT DISTINCT FROM OLD.assigned_to_personnel_id AND NEW.end_at IS NOT DISTINCT FROM OLD.end_at AND NEW.status=OLD.status AND NEW.unassigned_at IS NOT DISTINCT FROM OLD.unassigned_at THEN RETURN NEW; END IF;
IF NEW.assigned_to_personnel_id IS NOT NULL AND NEW.status='active' AND NEW.end_at IS NULL AND NEW.unassigned_at IS NULL AND NEW.location_id IS NOT NULL THEN
IF NOT EXISTS(SELECT 1 FROM public.location_assignments l WHERE l.location_id=NEW.location_id AND l.personnel_id=NEW.assigned_to_personnel_id AND l.status='active' AND (l.assigned_at IS NULL OR l.assigned_at<=now()) AND (l.unassigned_at IS NULL OR l.unassigned_at>now())) OR EXISTS(SELECT 1 FROM public.personnel_current_status s WHERE s.personnel_id=NEW.assigned_to_personnel_id AND s.project_id=NEW.project_id AND s.status='demobilized') THEN RAISE EXCEPTION 'Responsible person must be actively assigned at this location'; END IF;
END IF;
IF TG_OP='UPDATE' THEN UPDATE public.asset_custody_history SET ended_at=COALESCE(NEW.end_at,NEW.unassigned_at,at_time) WHERE assignment_id=NEW.id AND ended_at IS NULL; END IF;
IF NEW.assigned_to_personnel_id IS NOT NULL AND NEW.status='active' AND NEW.end_at IS NULL AND NEW.unassigned_at IS NULL THEN INSERT INTO public.asset_custody_history(assignment_id,personnel_id,started_at,changed_by) VALUES(NEW.id,NEW.assigned_to_personnel_id,CASE WHEN TG_OP='INSERT' THEN NEW.start_at ELSE at_time END,auth.uid()); END IF;
RETURN NEW; END $$;
CREATE TRIGGER track_asset_custody AFTER INSERT OR UPDATE ON public.asset_assignments FOR EACH ROW EXECUTE FUNCTION public.track_asset_custody();
CREATE FUNCTION public.release_personnel_asset_custody() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF TG_TABLE_NAME='location_assignments' THEN
IF NEW.status<>'active' AND OLD.status='active' THEN UPDATE public.asset_assignments SET assigned_to_personnel_id=NULL WHERE assigned_to_personnel_id=NEW.personnel_id AND location_id=NEW.location_id AND status='active' AND end_at IS NULL AND unassigned_at IS NULL; END IF;
ELSIF TG_TABLE_NAME='personnel_project_assignments' THEN
IF NEW.status<>'active' AND OLD.status='active' THEN UPDATE public.asset_assignments SET assigned_to_personnel_id=NULL WHERE assigned_to_personnel_id=NEW.personnel_id AND project_id=NEW.project_id AND status='active' AND end_at IS NULL AND unassigned_at IS NULL; END IF;
ELSIF TG_TABLE_NAME='personnel_status_log' THEN
IF NEW.status='demobilized' AND NEW.project_id IS NOT NULL THEN UPDATE public.asset_assignments SET assigned_to_personnel_id=NULL WHERE assigned_to_personnel_id=NEW.personnel_id AND project_id=NEW.project_id AND status='active' AND end_at IS NULL AND unassigned_at IS NULL; END IF;
END IF; RETURN NEW; END $$;
CREATE TRIGGER release_location_asset_custody AFTER UPDATE ON public.location_assignments FOR EACH ROW EXECUTE FUNCTION public.release_personnel_asset_custody();
CREATE TRIGGER release_project_asset_custody AFTER UPDATE ON public.personnel_project_assignments FOR EACH ROW EXECUTE FUNCTION public.release_personnel_asset_custody();
CREATE TRIGGER release_demobilized_asset_custody AFTER INSERT ON public.personnel_status_log FOR EACH ROW EXECUTE FUNCTION public.release_personnel_asset_custody();