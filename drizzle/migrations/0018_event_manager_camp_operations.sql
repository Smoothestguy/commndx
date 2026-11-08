CREATE TABLE public.event_locations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, address text NOT NULL DEFAULT '', timezone text NOT NULL DEFAULT 'America/Chicago', status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')), notes text NOT NULL DEFAULT '', created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_locations TO authenticated;
GRANT ALL ON public.event_locations TO service_role;
ALTER TABLE public.event_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_managers_all ON public.event_locations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TABLE public.event_companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_location_id uuid NOT NULL REFERENCES public.event_locations(id) ON DELETE CASCADE, name text NOT NULL, poc text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', customer_id uuid REFERENCES public.customers(id), created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,event_location_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_companies TO authenticated;
GRANT ALL ON public.event_companies TO service_role;
ALTER TABLE public.event_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_managers_all ON public.event_companies FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TABLE public.event_company_personnel (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_location_id uuid NOT NULL REFERENCES public.event_locations(id) ON DELETE CASCADE, company_id uuid NOT NULL, first_name text NOT NULL, last_name text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'in_camp' CHECK(status IN ('in_camp','checked_out')), badge_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(), created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,event_location_id), FOREIGN KEY(company_id,event_location_id) REFERENCES public.event_companies(id,event_location_id) ON DELETE CASCADE);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_company_personnel TO authenticated;
GRANT ALL ON public.event_company_personnel TO service_role;
ALTER TABLE public.event_company_personnel ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_managers_all ON public.event_company_personnel FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TABLE public.event_bunks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_location_id uuid NOT NULL REFERENCES public.event_locations(id) ON DELETE CASCADE, code text NOT NULL, section text NOT NULL DEFAULT '', capacity integer NOT NULL DEFAULT 1 CHECK(capacity=1), created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,event_location_id), UNIQUE(event_location_id,code));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_bunks TO authenticated;
GRANT ALL ON public.event_bunks TO service_role;
ALTER TABLE public.event_bunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_managers_all ON public.event_bunks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TABLE public.event_bunk_assignments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_location_id uuid NOT NULL REFERENCES public.event_locations(id) ON DELETE CASCADE, person_id uuid NOT NULL, bunk_id uuid NOT NULL, checked_in_at timestamptz NOT NULL DEFAULT now(), checked_out_at timestamptz, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(person_id,event_location_id) REFERENCES public.event_company_personnel(id,event_location_id) ON DELETE CASCADE, FOREIGN KEY(bunk_id,event_location_id) REFERENCES public.event_bunks(id,event_location_id) ON DELETE CASCADE);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_bunk_assignments TO authenticated;
GRANT ALL ON public.event_bunk_assignments TO service_role;
ALTER TABLE public.event_bunk_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_managers_all ON public.event_bunk_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE UNIQUE INDEX event_one_open_bunk ON public.event_bunk_assignments(bunk_id) WHERE checked_out_at IS NULL;
CREATE UNIQUE INDEX event_one_open_person ON public.event_bunk_assignments(person_id) WHERE checked_out_at IS NULL;
CREATE TABLE public.event_meal_scans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_location_id uuid NOT NULL REFERENCES public.event_locations(id) ON DELETE CASCADE, person_id uuid NOT NULL, meal_type text NOT NULL CHECK(meal_type IN ('breakfast','lunch','dinner')), service_date date NOT NULL DEFAULT current_date, scanned_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(person_id,event_location_id) REFERENCES public.event_company_personnel(id,event_location_id) ON DELETE CASCADE, UNIQUE(event_location_id,person_id,service_date,meal_type));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_meal_scans TO authenticated;
GRANT ALL ON public.event_meal_scans TO service_role;
ALTER TABLE public.event_meal_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_managers_all ON public.event_meal_scans FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TABLE public.event_laundry (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_location_id uuid NOT NULL REFERENCES public.event_locations(id) ON DELETE CASCADE, person_id uuid NOT NULL, tag text NOT NULL DEFAULT '', checked_in_at timestamptz NOT NULL DEFAULT now(), checked_out_at timestamptz, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(person_id,event_location_id) REFERENCES public.event_company_personnel(id,event_location_id) ON DELETE CASCADE);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_laundry TO authenticated;
GRANT ALL ON public.event_laundry TO service_role;
ALTER TABLE public.event_laundry ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_managers_all ON public.event_laundry FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE UNIQUE INDEX event_active_bag_tag ON public.event_laundry(event_location_id,tag) WHERE checked_out_at IS NULL AND tag <> '';
CREATE FUNCTION public.event_validate_write() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE zone text; camp_status text;
BEGIN
 NEW.updated_by := auth.uid(); NEW.updated_at := now();
 IF TG_OP='INSERT' THEN NEW.created_by := auth.uid(); NEW.created_at := now(); ELSE NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; END IF;
 IF TG_TABLE_NAME='event_locations' THEN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'Choose a valid camp timezone'; END IF;
 ELSE
  SELECT timezone,status INTO zone,camp_status FROM public.event_locations WHERE id=NEW.event_location_id FOR SHARE;
  IF camp_status='closed' THEN RAISE EXCEPTION 'Reopen the camp before making changes'; END IF;
  IF TG_OP='UPDATE' AND NEW.event_location_id<>OLD.event_location_id THEN RAISE EXCEPTION 'Camp cannot be changed'; END IF;
 END IF;
 IF TG_TABLE_NAME IN ('event_bunk_assignments','event_meal_scans','event_laundry') THEN
  IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM public.event_company_personnel WHERE id=NEW.person_id AND event_location_id=NEW.event_location_id AND status='in_camp') THEN RAISE EXCEPTION 'Person is checked out of camp'; END IF;
 END IF;
 IF TG_TABLE_NAME='event_meal_scans' THEN NEW.service_date := (NEW.scanned_at AT TIME ZONE zone)::date; END IF;
 IF TG_TABLE_NAME IN ('event_bunk_assignments','event_laundry') THEN
  IF NEW.checked_out_at IS NOT NULL AND NEW.checked_out_at<NEW.checked_in_at THEN RAISE EXCEPTION 'Check-out must be after check-in'; END IF;
 END IF;
 IF TG_TABLE_NAME='event_company_personnel' AND TG_OP='UPDATE' THEN
  IF NEW.company_id<>OLD.company_id THEN RAISE EXCEPTION 'Company cannot change on a historical roster record'; END IF;
  IF NEW.status='checked_out' AND EXISTS(SELECT 1 FROM public.event_bunk_assignments WHERE person_id=NEW.id AND checked_out_at IS NULL) THEN RAISE EXCEPTION 'Check out of the bunk first'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER event_validate BEFORE INSERT OR UPDATE ON public.event_locations FOR EACH ROW EXECUTE FUNCTION public.event_validate_write();
CREATE TRIGGER event_validate BEFORE INSERT OR UPDATE ON public.event_companies FOR EACH ROW EXECUTE FUNCTION public.event_validate_write();
CREATE TRIGGER event_validate BEFORE INSERT OR UPDATE ON public.event_company_personnel FOR EACH ROW EXECUTE FUNCTION public.event_validate_write();
CREATE TRIGGER event_validate BEFORE INSERT OR UPDATE ON public.event_bunks FOR EACH ROW EXECUTE FUNCTION public.event_validate_write();
CREATE TRIGGER event_validate BEFORE INSERT OR UPDATE ON public.event_bunk_assignments FOR EACH ROW EXECUTE FUNCTION public.event_validate_write();
CREATE TRIGGER event_validate BEFORE INSERT OR UPDATE ON public.event_meal_scans FOR EACH ROW EXECUTE FUNCTION public.event_validate_write();
CREATE TRIGGER event_validate BEFORE INSERT OR UPDATE ON public.event_laundry FOR EACH ROW EXECUTE FUNCTION public.event_validate_write();
CREATE INDEX ON public.event_companies(event_location_id);
CREATE INDEX ON public.event_company_personnel(event_location_id);
CREATE INDEX ON public.event_bunks(event_location_id);
CREATE INDEX ON public.event_bunk_assignments(event_location_id);
CREATE INDEX ON public.event_meal_scans(event_location_id,service_date);
CREATE INDEX ON public.event_laundry(event_location_id);