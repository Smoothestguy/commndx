-- Create project_personnel_rate_history table for tracking pay rate changes
CREATE TABLE public.project_personnel_rate_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.personnel_project_assignments(id) ON DELETE SET NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz NULL,
  pay_rate numeric NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add unique constraint: only one active rate per assignment
CREATE UNIQUE INDEX idx_unique_active_rate_per_assignment 
ON public.project_personnel_rate_history (project_id, personnel_id)
WHERE effective_to IS NULL;

-- Add indexes for efficient queries
CREATE INDEX idx_rate_history_project_personnel 
ON public.project_personnel_rate_history (project_id, personnel_id);

CREATE INDEX idx_rate_history_assignment 
ON public.project_personnel_rate_history (assignment_id);

CREATE INDEX idx_rate_history_effective_dates 
ON public.project_personnel_rate_history (effective_from, effective_to);

-- Enable RLS
ALTER TABLE public.project_personnel_rate_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users with project access can view rate history"
ON public.project_personnel_rate_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'manager')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.project_assignments pa
    WHERE pa.project_id = project_personnel_rate_history.project_id
    AND pa.user_id = auth.uid()
    AND pa.status = 'active'
  )
);

CREATE POLICY "Admins and managers can insert rate history"
ON public.project_personnel_rate_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins and managers can update rate history"
ON public.project_personnel_rate_history
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'manager')
  )
);

-- Add comment
COMMENT ON TABLE public.project_personnel_rate_history IS 
'Tracks historical pay rate changes for personnel on specific projects. Only one active rate (effective_to IS NULL) per project/personnel combination allowed.';

-- Rename hourly_rate to pay_rate_snapshot on time_entries for clarity (if exists)
-- Actually, keep hourly_rate as it is since it's already being used, but add a comment
COMMENT ON COLUMN public.time_entries.hourly_rate IS 
'Snapshot of the pay rate at the time of this entry. Once set, should not be modified to preserve historical accuracy.';