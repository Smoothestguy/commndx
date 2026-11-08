CREATE TABLE public.event_task_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_location_id uuid NOT NULL REFERENCES public.event_locations(id) ON DELETE CASCADE,
 company_id uuid,
 number text NOT NULL CHECK(length(trim(number))>0),
 kind text NOT NULL CHECK(kind IN ('initial','increase','decrease','demobilization')),
 effective_date date NOT NULL,
 notes text NOT NULL DEFAULT '',
 lines jsonb NOT NULL DEFAULT '[{"label":"Pax","qty_delta":0}]'::jsonb,
 created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(company_id,event_location_id) REFERENCES public.event_companies(id,event_location_id),
 UNIQUE(event_location_id,number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_task_orders TO authenticated;
GRANT ALL ON public.event_task_orders TO service_role;
ALTER TABLE public.event_task_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_managers_all ON public.event_task_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE FUNCTION public.event_validate_task_order_lines() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE line jsonb;
BEGIN
 IF jsonb_typeof(NEW.lines)<>'array' OR jsonb_array_length(NEW.lines)=0 OR jsonb_array_length(NEW.lines)>100 THEN RAISE EXCEPTION 'Enter 1–100 authorization lines'; END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(NEW.lines) LOOP
  IF jsonb_typeof(line)<>'object' OR jsonb_typeof(line->'label') IS DISTINCT FROM 'string' OR length(trim(line->>'label'))=0 OR jsonb_typeof(line->'qty_delta') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Each line needs a label and numeric quantity delta'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER event_validate BEFORE INSERT OR UPDATE ON public.event_task_orders FOR EACH ROW EXECUTE FUNCTION public.event_validate_write();
CREATE TRIGGER event_validate_lines BEFORE INSERT OR UPDATE ON public.event_task_orders FOR EACH ROW EXECUTE FUNCTION public.event_validate_task_order_lines();
CREATE INDEX ON public.event_task_orders(event_location_id,effective_date);
CREATE OR REPLACE FUNCTION public.event_validate_write() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE zone text; location_status text;
BEGIN
 NEW.updated_by := auth.uid(); NEW.updated_at := now();
 IF TG_OP='INSERT' THEN NEW.created_by := auth.uid(); NEW.created_at := now(); ELSE NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; END IF;
 IF TG_TABLE_NAME='event_locations' THEN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'Choose a valid location timezone'; END IF;
 ELSE
  SELECT timezone,status INTO zone,location_status FROM public.event_locations WHERE id=NEW.event_location_id FOR SHARE;
  IF location_status='closed' THEN RAISE EXCEPTION 'Reopen the location before making changes'; END IF;
  IF TG_OP='UPDATE' AND NEW.event_location_id<>OLD.event_location_id THEN RAISE EXCEPTION 'Location cannot be changed'; END IF;
 END IF;
 IF TG_TABLE_NAME IN ('event_bunk_assignments','event_meal_scans','event_laundry') THEN
  IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM public.event_company_personnel WHERE id=NEW.person_id AND event_location_id=NEW.event_location_id AND status='in_camp') THEN RAISE EXCEPTION 'Person is checked out of this location'; END IF;
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