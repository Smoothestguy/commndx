-- Add unassignment audit fields to personnel_project_assignments
ALTER TABLE public.personnel_project_assignments
ADD COLUMN IF NOT EXISTS unassigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unassigned_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS unassigned_reason TEXT,
ADD COLUMN IF NOT EXISTS unassigned_notes TEXT;

-- Add unassignment reason and notes to asset_assignments (already has unassigned_at and unassigned_by)
ALTER TABLE public.asset_assignments
ADD COLUMN IF NOT EXISTS unassigned_reason TEXT,
ADD COLUMN IF NOT EXISTS unassigned_notes TEXT;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_personnel_project_assignments_unassigned 
ON public.personnel_project_assignments(project_id, status, unassigned_at);

CREATE INDEX IF NOT EXISTS idx_asset_assignments_unassigned 
ON public.asset_assignments(project_id, assigned_to_personnel_id, unassigned_at);

-- Add comments for documentation
COMMENT ON COLUMN public.personnel_project_assignments.unassigned_reason IS 'Enum-like: sent_home, no_show, left_site, terminated, project_ended, other';
COMMENT ON COLUMN public.asset_assignments.unassigned_reason IS 'Enum-like: transfer_to_project, returned_or_released, not_returned';