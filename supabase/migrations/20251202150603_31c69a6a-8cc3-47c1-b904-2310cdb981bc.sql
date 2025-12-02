-- Create personnel_project_assignments table
CREATE TABLE public.personnel_project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(personnel_id, project_id)
);

-- Enable RLS
ALTER TABLE public.personnel_project_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and managers can manage personnel assignments"
  ON public.personnel_project_assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view personnel assignments"
  ON public.personnel_project_assignments FOR SELECT
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_personnel_project_assignments_updated_at
  BEFORE UPDATE ON public.personnel_project_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add personnel_id column to time_entries (optional, for admin-logged time)
ALTER TABLE public.time_entries 
ADD COLUMN personnel_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_time_entries_personnel_id ON public.time_entries(personnel_id);