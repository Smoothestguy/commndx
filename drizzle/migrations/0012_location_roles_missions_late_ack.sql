ALTER TABLE public.visit_personnel
  ADD COLUMN IF NOT EXISTS late_ack_reason text,
  ADD COLUMN IF NOT EXISTS late_ack_by uuid,
  ADD COLUMN IF NOT EXISTS late_ack_at timestamptz;

ALTER TABLE public.location_assignments
  ADD COLUMN IF NOT EXISTS mission_day date,
  ADD COLUMN IF NOT EXISTS mission_note text;

CREATE TABLE IF NOT EXISTS public.location_assignment_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.location_assignments(id) ON DELETE CASCADE,
  role_label text,
  effective_from timestamptz NOT NULL,
  set_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS location_assignment_roles_asg_idx ON public.location_assignment_roles(assignment_id, effective_from);

GRANT SELECT ON public.location_assignment_roles TO authenticated;
GRANT INSERT ON public.location_assignment_roles TO authenticated;
GRANT ALL ON public.location_assignment_roles TO service_role;
ALTER TABLE public.location_assignment_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view assignment roles" ON public.location_assignment_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'user'));
CREATE POLICY "Managers add assignment roles" ON public.location_assignment_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

INSERT INTO public.location_assignment_roles(assignment_id, role_label, effective_from)
SELECT id, role_label, '1970-01-01'::timestamptz FROM public.location_assignments a
WHERE NOT EXISTS (SELECT 1 FROM public.location_assignment_roles r WHERE r.assignment_id = a.id);

DROP POLICY IF EXISTS "Managers manage location assignments" ON public.location_assignments;
CREATE POLICY "Managers manage location assignments" ON public.location_assignments FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));