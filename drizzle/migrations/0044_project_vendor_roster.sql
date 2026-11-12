CREATE TABLE public.project_vendors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.projects(id), vendor_id uuid NOT NULL REFERENCES public.vendors(id), added_by uuid, added_at timestamptz NOT NULL DEFAULT now(), active boolean NOT NULL DEFAULT true, updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,vendor_id)
);
GRANT SELECT, INSERT, UPDATE ON public.project_vendors TO authenticated;
GRANT ALL ON public.project_vendors TO service_role;
ALTER TABLE public.project_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read project vendors" ON public.project_vendors FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'accounting'));
CREATE POLICY "Managers manage project vendors" ON public.project_vendors FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE INDEX project_vendors_active_project ON public.project_vendors(project_id) WHERE active;
INSERT INTO public.project_vendors(project_id,vendor_id)
SELECT DISTINCT used.project_id,used.vendor_id FROM (
 SELECT l.project_id,p.vendor_id FROM public.location_assignments la JOIN public.project_locations l ON l.id=la.location_id JOIN public.personnel p ON p.id=la.personnel_id
 UNION SELECT pa.project_id,p.vendor_id FROM public.personnel_project_assignments pa JOIN public.personnel p ON p.id=pa.personnel_id
 UNION SELECT project_id,vendor_id FROM public.project_join_tokens
 UNION SELECT aa.project_id,a.vendor_id FROM public.asset_assignments aa JOIN public.assets a ON a.id=aa.asset_id
 UNION SELECT project_id,vendor_id FROM public.purchase_orders
) used WHERE used.vendor_id IS NOT NULL AND used.project_id IS NOT NULL ON CONFLICT DO NOTHING;
CREATE FUNCTION public.project_vendor_names(p_project uuid) RETURNS TABLE(id uuid,name text,active boolean,added_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT v.id,v.name,pv.active,pv.added_at FROM public.project_vendors pv JOIN public.vendors v ON v.id=pv.vendor_id WHERE pv.project_id=p_project AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'accounting')) ORDER BY v.name
$$;
REVOKE ALL ON FUNCTION public.project_vendor_names(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_vendor_names(uuid) TO authenticated,service_role;
CREATE FUNCTION public.stamp_project_vendor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
 IF NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id THEN RAISE EXCEPTION 'Project vendor identity cannot change'; END IF;
 NEW.added_by:=OLD.added_by; NEW.added_at:=OLD.added_at;
 ELSE NEW.added_by:=auth.uid(); NEW.added_at:=now(); END IF;
 NEW.updated_by:=auth.uid(); NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER stamp_project_vendor BEFORE INSERT OR UPDATE ON public.project_vendors FOR EACH ROW EXECUTE FUNCTION public.stamp_project_vendor();
CREATE FUNCTION public.audit_project_vendor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.audit_logs(user_id,action_type,resource_type,resource_id,changes_before,changes_after,metadata,success) VALUES(auth.uid(),CASE WHEN TG_OP='INSERT' THEN 'create' ELSE 'update' END,'project_vendor',NEW.id,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW),jsonb_build_object('project_id',NEW.project_id,'vendor_id',NEW.vendor_id),true); RETURN NEW;
END $$;
CREATE TRIGGER audit_project_vendor AFTER INSERT OR UPDATE ON public.project_vendors FOR EACH ROW EXECUTE FUNCTION public.audit_project_vendor();
CREATE FUNCTION public.guard_join_project_vendor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.vendor_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id OR NEW.project_id IS DISTINCT FROM OLD.project_id) AND NOT EXISTS(SELECT 1 FROM public.project_vendors WHERE project_id=NEW.project_id AND vendor_id=NEW.vendor_id AND active) THEN RAISE EXCEPTION 'Add this vendor to the project first'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER guard_join_project_vendor BEFORE INSERT OR UPDATE ON public.project_join_tokens FOR EACH ROW EXECUTE FUNCTION public.guard_join_project_vendor();