-- Add pay_rate column to personnel_project_assignments table
-- This captures the project-specific pay rate for each personnel assignment
ALTER TABLE public.personnel_project_assignments 
ADD COLUMN IF NOT EXISTS pay_rate numeric;

-- Add index for pay_rate queries
CREATE INDEX IF NOT EXISTS idx_personnel_project_assignments_pay_rate 
ON public.personnel_project_assignments(pay_rate) 
WHERE pay_rate IS NOT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN public.personnel_project_assignments.pay_rate IS 
'Project-specific pay rate for this personnel assignment. Separate from personnel default_pay_rate.';