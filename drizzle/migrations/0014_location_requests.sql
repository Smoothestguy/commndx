CREATE TABLE public.location_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.project_locations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('personnel','asset','other','cancellation')),
  label text,
  qty integer NOT NULL DEFAULT 1 CHECK (qty > 0 AND qty <= 999),
  note text CHECK (note IS NULL OR length(note) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','denied','done')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  acted_by uuid,
  acted_at timestamptz,
  CHECK (label IS NULL OR length(label) <= 120)
);
CREATE INDEX location_requests_location_idx ON public.location_requests(location_id, status);
GRANT SELECT, INSERT, UPDATE ON public.location_requests TO authenticated;
GRANT ALL ON public.location_requests TO service_role;
ALTER TABLE public.location_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_field_member_of_location(_location uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.location_assignments la
    WHERE la.location_id = _location AND la.status = 'active' AND la.unassigned_at IS NULL
      AND la.personnel_id = public.get_personnel_id_for_user(auth.uid()))
$$;
REVOKE EXECUTE ON FUNCTION public.is_field_member_of_location(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_field_member_of_location(uuid) TO authenticated;

CREATE POLICY "Managers manage location requests" ON public.location_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Field members read own location requests" ON public.location_requests FOR SELECT TO authenticated
  USING (public.is_field_member_of_location(location_id));
CREATE POLICY "Field members raise requests" ON public.location_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_field_member_of_location(location_id) AND created_by = auth.uid() AND status = 'open' AND acted_by IS NULL AND acted_at IS NULL);

CREATE OR REPLACE FUNCTION public.stamp_location_request()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid(); NEW.created_at := now();
    IF NEW.status <> 'open' THEN NEW.acted_by := auth.uid(); NEW.acted_at := now(); END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.acted_by := auth.uid(); NEW.acted_at := now();
    NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; NEW.location_id := OLD.location_id;
  ELSE
    NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; NEW.location_id := OLD.location_id;
    NEW.acted_by := OLD.acted_by; NEW.acted_at := OLD.acted_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER location_requests_stamp BEFORE INSERT OR UPDATE ON public.location_requests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_location_request();