CREATE TABLE public.location_day_expected (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.project_locations(id) ON DELETE RESTRICT,
  day date NOT NULL,
  supervisors integer NOT NULL DEFAULT 0 CHECK (supervisors >= 0),
  technicians integer NOT NULL DEFAULT 0 CHECK (technicians >= 0),
  operators integer NOT NULL DEFAULT 0 CHECK (operators >= 0),
  source text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, day)
);
GRANT SELECT, INSERT, UPDATE ON public.location_day_expected TO authenticated;
GRANT ALL ON public.location_day_expected TO service_role;
ALTER TABLE public.location_day_expected ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read expected headcount" ON public.location_day_expected FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Admins insert expected headcount" ON public.location_day_expected FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins update expected headcount" ON public.location_day_expected FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));