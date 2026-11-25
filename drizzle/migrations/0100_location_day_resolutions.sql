CREATE TABLE public.location_day_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.project_locations(id) ON DELETE CASCADE,
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  day date NOT NULL,
  reason text NOT NULL CHECK (reason IN ('day_off','other_site')),
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, personnel_id, day)
);
COMMENT ON TABLE public.location_day_resolutions IS 'Manager notes for roster people with no stay that day. Never worked time, hours, headcount or billing.';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_day_resolutions TO authenticated;
GRANT ALL ON public.location_day_resolutions TO service_role;
ALTER TABLE public.location_day_resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage day resolutions" ON public.location_day_resolutions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'user'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'user'));