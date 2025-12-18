-- Create project rate brackets table for role-based billing
CREATE TABLE public.project_rate_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bill_rate NUMERIC NOT NULL DEFAULT 0,
  overtime_multiplier NUMERIC NOT NULL DEFAULT 1.5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

-- Add rate_bracket_id to personnel_project_assignments
ALTER TABLE public.personnel_project_assignments
  ADD COLUMN rate_bracket_id UUID REFERENCES public.project_rate_brackets(id) ON DELETE SET NULL;

-- Enable RLS on project_rate_brackets
ALTER TABLE public.project_rate_brackets ENABLE ROW LEVEL SECURITY;

-- Admins and managers can manage rate brackets
CREATE POLICY "Admins and managers can manage rate brackets"
  ON public.project_rate_brackets
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Authenticated users can view rate brackets
CREATE POLICY "Authenticated users can view rate brackets"
  ON public.project_rate_brackets
  FOR SELECT
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_project_rate_brackets_updated_at
  BEFORE UPDATE ON public.project_rate_brackets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();