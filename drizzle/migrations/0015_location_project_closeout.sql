ALTER TABLE public.project_locations ADD COLUMN IF NOT EXISTS closed_at timestamptz, ADD COLUMN IF NOT EXISTS closed_by uuid, ADD COLUMN IF NOT EXISTS closeout_date date, ADD COLUMN IF NOT EXISTS closeout_notes text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS closed_at timestamptz, ADD COLUMN IF NOT EXISTS closed_by uuid, ADD COLUMN IF NOT EXISTS closeout_summary jsonb;

CREATE OR REPLACE FUNCTION public.guard_location_closeout() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n_open int; n_req int; n_join int;
BEGIN
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Only managers can close out a location'; END IF;
    SELECT count(*) INTO n_open FROM visit_personnel vp JOIN location_visits lv ON lv.id = vp.visit_id
      WHERE lv.location_id = NEW.id AND COALESCE(vp.checked_out_at, lv.check_out_at) IS NULL;
    SELECT count(*) INTO n_req FROM location_requests WHERE location_id = NEW.id AND status IN ('open','accepted');
    SELECT count(*) INTO n_join FROM project_join_requests WHERE location_id = NEW.id AND status = 'pending';
    IF n_open > 0 OR n_req > 0 OR n_join > 0 THEN
      RAISE EXCEPTION 'Cannot close: % open punch(es), % pending field request(s), % pending join request(s)', n_open, n_req, n_join;
    END IF;
    NEW.closed_at := now(); NEW.closed_by := auth.uid();
  ELSIF OLD.status = 'closed' AND NEW.status IS DISTINCT FROM 'closed' THEN
    IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins can reopen a closed location'; END IF;
    NEW.closed_at := NULL; NEW.closed_by := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_location_closeout ON public.project_locations;
CREATE TRIGGER trg_guard_location_closeout BEFORE UPDATE OF status ON public.project_locations FOR EACH ROW EXECUTE FUNCTION public.guard_location_closeout();

-- Closed locations accept no new stays or join requests (self, kiosk, link); managers may still correct history.
CREATE OR REPLACE FUNCTION public.block_closed_location_writes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE loc uuid;
BEGIN
  IF TG_TABLE_NAME = 'visit_personnel' THEN SELECT location_id INTO loc FROM location_visits WHERE id = NEW.visit_id;
  ELSE loc := NEW.location_id; END IF;
  IF loc IS NOT NULL AND EXISTS (SELECT 1 FROM project_locations WHERE id = loc AND status = 'closed')
     AND NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'This location is closed' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_block_closed_vp ON public.visit_personnel;
CREATE TRIGGER trg_block_closed_vp BEFORE INSERT ON public.visit_personnel FOR EACH ROW EXECUTE FUNCTION public.block_closed_location_writes();
DROP TRIGGER IF EXISTS trg_block_closed_visit ON public.location_visits;
CREATE TRIGGER trg_block_closed_visit BEFORE INSERT ON public.location_visits FOR EACH ROW EXECUTE FUNCTION public.block_closed_location_writes();
DROP TRIGGER IF EXISTS trg_block_closed_join ON public.project_join_requests;
CREATE TRIGGER trg_block_closed_join BEFORE INSERT ON public.project_join_requests FOR EACH ROW EXECUTE FUNCTION public.block_closed_location_writes();

CREATE OR REPLACE FUNCTION public.guard_project_closeout() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NEW.closed_at IS NOT NULL AND OLD.closed_at IS NULL THEN
    IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Only managers can close out a project'; END IF;
    SELECT count(*) INTO n FROM project_locations WHERE project_id = NEW.id AND status IS DISTINCT FROM 'closed';
    IF n > 0 THEN RAISE EXCEPTION 'Cannot close project: % location(s) still open', n; END IF;
    NEW.closed_by := auth.uid();
  ELSIF OLD.closed_at IS NOT NULL AND NEW.closed_at IS NULL THEN
    IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins can reopen a closed project'; END IF;
    NEW.closed_by := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_project_closeout ON public.projects;
CREATE TRIGGER trg_guard_project_closeout BEFORE UPDATE OF closed_at ON public.projects FOR EACH ROW EXECUTE FUNCTION public.guard_project_closeout();