
-- Create personnel_hotel_assignments table
CREATE TABLE public.personnel_hotel_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  personnel_project_assignment_id uuid REFERENCES public.personnel_project_assignments(id) ON DELETE SET NULL,
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  hotel_name text NOT NULL,
  hotel_address text,
  hotel_city text,
  hotel_state text,
  hotel_zip text,
  hotel_phone text,
  room_number text,
  confirmation_number text,
  check_in date NOT NULL,
  check_out date,
  nightly_rate numeric,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_hotel_assignments_project ON public.personnel_hotel_assignments(project_id);
CREATE INDEX idx_hotel_assignments_personnel ON public.personnel_hotel_assignments(personnel_id);
CREATE INDEX idx_hotel_assignments_status ON public.personnel_hotel_assignments(status);

-- Updated_at trigger
CREATE TRIGGER update_hotel_assignments_updated_at
  BEFORE UPDATE ON public.personnel_hotel_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.personnel_hotel_assignments ENABLE ROW LEVEL SECURITY;

-- RLS: Admin/Manager full access
CREATE POLICY "Admin/Manager full access to hotel assignments"
  ON public.personnel_hotel_assignments
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  );

-- RLS: Users with project assignment can view
CREATE POLICY "Assigned users can view hotel assignments"
  ON public.personnel_hotel_assignments
  FOR SELECT
  USING (
    public.is_assigned_to_project(auth.uid(), project_id)
  );

-- RLS: Users with permission can manage
CREATE POLICY "Users with permission can manage hotel assignments"
  ON public.personnel_hotel_assignments
  FOR ALL
  USING (
    public.has_permission(auth.uid(), 'projects', 'edit')
  )
  WITH CHECK (
    public.has_permission(auth.uid(), 'projects', 'edit')
  );
