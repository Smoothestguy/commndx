ALTER TABLE public.event_locations ADD COLUMN customer_id uuid REFERENCES public.customers(id), ADD COLUMN customer_name text NOT NULL DEFAULT '', ADD COLUMN contract_reference text NOT NULL DEFAULT '', ADD COLUMN poc_name text NOT NULL DEFAULT '', ADD COLUMN poc_phone text NOT NULL DEFAULT '', ADD COLUMN poc_email text NOT NULL DEFAULT '', ADD COLUMN billing_notes text NOT NULL DEFAULT '';
CREATE TABLE public.event_asset_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_location_id uuid NOT NULL REFERENCES public.event_locations(id) ON DELETE CASCADE,
 asset_id uuid NOT NULL REFERENCES public.assets(id), company_id uuid, responsible_person_id uuid,
 start_at timestamptz NOT NULL DEFAULT now(), end_at timestamptz, bill_rate numeric CHECK(bill_rate>=0), notes text NOT NULL DEFAULT '',
 created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(company_id,event_location_id) REFERENCES public.event_companies(id,event_location_id), FOREIGN KEY(responsible_person_id,event_location_id) REFERENCES public.event_company_personnel(id,event_location_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.event_asset_assignments TO authenticated;
GRANT ALL ON public.event_asset_assignments TO service_role;
ALTER TABLE public.event_asset_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_managers_all ON public.event_asset_assignments FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE UNIQUE INDEX event_asset_open ON public.event_asset_assignments(asset_id) WHERE end_at IS NULL;
CREATE INDEX ON public.event_asset_assignments(event_location_id);
CREATE TABLE public.event_fuel_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_location_id uuid NOT NULL REFERENCES public.event_locations(id) ON DELETE CASCADE,
 asset_id uuid REFERENCES public.assets(id), company_id uuid, logged_at timestamptz NOT NULL DEFAULT now(), gallons numeric NOT NULL CHECK(gallons>0), fuel_type text NOT NULL CHECK(fuel_type IN ('diesel','gas')), note text NOT NULL DEFAULT '', logged_by uuid NOT NULL DEFAULT auth.uid(),
 created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(company_id,event_location_id) REFERENCES public.event_companies(id,event_location_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.event_fuel_logs TO authenticated;
GRANT ALL ON public.event_fuel_logs TO service_role;
ALTER TABLE public.event_fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_managers_all ON public.event_fuel_logs FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE INDEX ON public.event_fuel_logs(event_location_id,logged_at);
CREATE TABLE public.event_sov_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_location_id uuid NOT NULL REFERENCES public.event_locations(id) ON DELETE CASCADE, label text NOT NULL CHECK(length(trim(label))>0),
 unit_type text NOT NULL CHECK(unit_type IN ('PPPD','per_day','per_each','per_gallon','lump_sum')), unit_description text NOT NULL DEFAULT '', company_id uuid,
 source text NOT NULL CHECK(source IN ('lodging','breakfast','lunch','dinner','laundry','fuel','equipment','manual')), internal_rate numeric CHECK(internal_rate>=0), sort_order integer NOT NULL DEFAULT 0,
 created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,event_location_id), FOREIGN KEY(company_id,event_location_id) REFERENCES public.event_companies(id,event_location_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.event_sov_lines TO authenticated;
GRANT ALL ON public.event_sov_lines TO service_role;
ALTER TABLE public.event_sov_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_managers_all ON public.event_sov_lines FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE INDEX ON public.event_sov_lines(event_location_id);
CREATE TABLE public.event_sov_quantities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_location_id uuid NOT NULL REFERENCES public.event_locations(id) ON DELETE CASCADE, sov_line_id uuid NOT NULL, service_date date NOT NULL, company_id uuid, quantity numeric NOT NULL CHECK(quantity>=0), note text NOT NULL DEFAULT '',
 created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(sov_line_id,event_location_id) REFERENCES public.event_sov_lines(id,event_location_id), FOREIGN KEY(company_id,event_location_id) REFERENCES public.event_companies(id,event_location_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.event_sov_quantities TO authenticated;
GRANT ALL ON public.event_sov_quantities TO service_role;
ALTER TABLE public.event_sov_quantities ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_managers_all ON public.event_sov_quantities FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE INDEX ON public.event_sov_quantities(event_location_id,service_date);
CREATE TRIGGER event_validate BEFORE INSERT OR UPDATE ON public.event_asset_assignments FOR EACH ROW EXECUTE FUNCTION public.event_validate_write();
CREATE TRIGGER event_validate BEFORE INSERT OR UPDATE ON public.event_fuel_logs FOR EACH ROW EXECUTE FUNCTION public.event_validate_write();
CREATE TRIGGER event_validate BEFORE INSERT OR UPDATE ON public.event_sov_lines FOR EACH ROW EXECUTE FUNCTION public.event_validate_write();
CREATE TRIGGER event_validate BEFORE INSERT OR UPDATE ON public.event_sov_quantities FOR EACH ROW EXECUTE FUNCTION public.event_validate_write();
CREATE FUNCTION public.event_validate_services() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE source_kind text; scope_id uuid;
BEGIN
 IF TG_TABLE_NAME='event_asset_assignments' THEN
  IF NEW.end_at IS NOT NULL AND NEW.end_at<=NEW.start_at THEN RAISE EXCEPTION 'End time must be after arrival'; END IF;
  IF NEW.responsible_person_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.event_company_personnel WHERE id=NEW.responsible_person_id AND event_location_id=NEW.event_location_id AND status='in_camp') THEN RAISE EXCEPTION 'Responsible person must be at this location'; END IF;
  IF TG_OP='UPDATE' AND (NEW.asset_id<>OLD.asset_id OR NEW.company_id IS DISTINCT FROM OLD.company_id) THEN RAISE EXCEPTION 'Move the asset to change its placement or company'; END IF;
 ELSIF TG_TABLE_NAME='event_fuel_logs' THEN
  IF TG_OP='INSERT' THEN NEW.logged_by:=auth.uid(); ELSE NEW.logged_by:=OLD.logged_by; END IF;
  IF NEW.asset_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.event_asset_assignments WHERE asset_id=NEW.asset_id AND event_location_id=NEW.event_location_id AND start_at<=NEW.logged_at AND (end_at IS NULL OR end_at>NEW.logged_at)) THEN RAISE EXCEPTION 'Asset was not at this location at the logged time'; END IF;
 ELSIF TG_TABLE_NAME='event_sov_quantities' THEN
  SELECT source,company_id INTO source_kind,scope_id FROM public.event_sov_lines WHERE id=NEW.sov_line_id AND event_location_id=NEW.event_location_id;
  IF source_kind IS DISTINCT FROM 'manual' THEN RAISE EXCEPTION 'Only manual SOV lines accept entered quantities'; END IF;
  IF scope_id IS NOT NULL AND NEW.company_id IS DISTINCT FROM scope_id THEN RAISE EXCEPTION 'Quantity company must match the SOV line'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER event_validate_services BEFORE INSERT OR UPDATE ON public.event_asset_assignments FOR EACH ROW EXECUTE FUNCTION public.event_validate_services();
CREATE TRIGGER event_validate_services BEFORE INSERT OR UPDATE ON public.event_fuel_logs FOR EACH ROW EXECUTE FUNCTION public.event_validate_services();
CREATE TRIGGER event_validate_services BEFORE INSERT OR UPDATE ON public.event_sov_quantities FOR EACH ROW EXECUTE FUNCTION public.event_validate_services();
CREATE FUNCTION public.event_asset_no_overlap() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE finish timestamptz;
BEGIN
 PERFORM 1 FROM public.assets WHERE id=NEW.asset_id FOR UPDATE;
 IF TG_TABLE_NAME='event_asset_assignments' THEN
  IF EXISTS(SELECT 1 FROM public.event_asset_assignments a WHERE a.asset_id=NEW.asset_id AND a.id<>NEW.id AND tstzrange(a.start_at,a.end_at,'[)') && tstzrange(NEW.start_at,NEW.end_at,'[)')) OR EXISTS(SELECT 1 FROM public.asset_assignments a WHERE a.asset_id=NEW.asset_id AND tstzrange(a.start_at,coalesce(a.end_at,a.unassigned_at),'[)') && tstzrange(NEW.start_at,NEW.end_at,'[)')) THEN RAISE EXCEPTION 'Asset is already placed during these dates; move or unassign it first'; END IF;
 ELSE
  finish:=coalesce(NEW.end_at,NEW.unassigned_at);
  IF EXISTS(SELECT 1 FROM public.event_asset_assignments a WHERE a.asset_id=NEW.asset_id AND tstzrange(a.start_at,a.end_at,'[)') && tstzrange(NEW.start_at,finish,'[)')) THEN RAISE EXCEPTION 'Asset is assigned to an event location during these dates'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.event_asset_no_overlap() FROM PUBLIC;
CREATE TRIGGER event_asset_overlap BEFORE INSERT OR UPDATE ON public.event_asset_assignments FOR EACH ROW EXECUTE FUNCTION public.event_asset_no_overlap();
CREATE TRIGGER event_asset_overlap BEFORE INSERT OR UPDATE ON public.asset_assignments FOR EACH ROW EXECUTE FUNCTION public.event_asset_no_overlap();
CREATE FUNCTION public.event_move_asset(p_assignment_id uuid,p_location_id uuid,p_start_at timestamptz,p_person_id uuid DEFAULT NULL,p_company_id uuid DEFAULT NULL,p_bill_rate numeric DEFAULT NULL,p_notes text DEFAULT '') RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE previous public.event_asset_assignments; next_id uuid;
BEGIN
 IF NOT(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Manager access required'; END IF;
 SELECT * INTO previous FROM public.event_asset_assignments WHERE id=p_assignment_id FOR UPDATE;
 IF previous.id IS NULL OR previous.end_at IS NOT NULL THEN RAISE EXCEPTION 'Placement is no longer active'; END IF;
 IF p_start_at<=previous.start_at THEN RAISE EXCEPTION 'Move time must be after arrival'; END IF;
 UPDATE public.event_asset_assignments SET end_at=p_start_at WHERE id=previous.id;
 INSERT INTO public.event_asset_assignments(event_location_id,asset_id,company_id,responsible_person_id,start_at,bill_rate,notes) VALUES(p_location_id,previous.asset_id,p_company_id,p_person_id,p_start_at,p_bill_rate,p_notes) RETURNING id INTO next_id;
 RETURN next_id;
END $$;
REVOKE ALL ON FUNCTION public.event_move_asset(uuid,uuid,timestamptz,uuid,uuid,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_move_asset(uuid,uuid,timestamptz,uuid,uuid,numeric,text) TO authenticated;
CREATE FUNCTION public.event_release_responsibility() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.status='checked_out' AND OLD.status IS DISTINCT FROM NEW.status THEN
  UPDATE public.event_asset_assignments SET responsible_person_id=NULL WHERE responsible_person_id=NEW.id AND end_at IS NULL;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER event_release_responsibility AFTER UPDATE OF status ON public.event_company_personnel FOR EACH ROW EXECUTE FUNCTION public.event_release_responsibility();
CREATE FUNCTION public.event_seed_sov() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 INSERT INTO public.event_sov_lines(event_location_id,label,unit_type,unit_description,source,sort_order) VALUES
 (NEW.id,'Lodging','PPPD','Person per day','lodging',0),(NEW.id,'Meals - Breakfast','per_each','Meal','breakfast',1),(NEW.id,'Meals - Lunch','per_each','Meal','lunch',2),(NEW.id,'Meals - Dinner','per_each','Meal','dinner',3),(NEW.id,'Laundry','per_each','Bag check-in','laundry',4),(NEW.id,'Fuel','per_gallon','Gallon','fuel',5),(NEW.id,'Equipment','per_day','Asset day','equipment',6);
 RETURN NEW; END $$;
CREATE TRIGGER event_seed_sov AFTER INSERT ON public.event_locations FOR EACH ROW EXECUTE FUNCTION public.event_seed_sov();