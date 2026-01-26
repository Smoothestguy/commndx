-- 1. Drop the existing unique constraint
ALTER TABLE public.personnel_project_assignments 
DROP CONSTRAINT IF EXISTS personnel_project_assignments_personnel_id_project_id_key;

-- 2. Add partial unique index (only one ACTIVE assignment per personnel-project)
CREATE UNIQUE INDEX IF NOT EXISTS personnel_project_assignments_active_unique 
ON public.personnel_project_assignments (personnel_id, project_id) 
WHERE status = 'active';

-- 3. Add index for efficient history queries
CREATE INDEX IF NOT EXISTS idx_personnel_assignments_history 
ON public.personnel_project_assignments (personnel_id, assigned_at DESC);