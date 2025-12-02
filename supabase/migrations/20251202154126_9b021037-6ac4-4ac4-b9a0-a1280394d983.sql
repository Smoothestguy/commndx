-- Add last_time_entry_at column to personnel_project_assignments
ALTER TABLE public.personnel_project_assignments 
ADD COLUMN IF NOT EXISTS last_time_entry_at TIMESTAMP WITH TIME ZONE;

-- Create audit log table for tracking automatic removals
CREATE TABLE IF NOT EXISTS public.assignment_removal_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_type TEXT NOT NULL, -- 'user' or 'personnel'
  assignment_id UUID NOT NULL,
  user_id UUID,
  personnel_id UUID,
  project_id UUID NOT NULL,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  removed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  days_inactive INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on assignment_removal_log
ALTER TABLE public.assignment_removal_log ENABLE ROW LEVEL SECURITY;

-- Admins and managers can view removal logs
CREATE POLICY "Admins and managers can view removal logs"
ON public.assignment_removal_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Create trigger function for personnel activity tracking
CREATE OR REPLACE FUNCTION public.update_personnel_assignment_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Update personnel_project_assignments when time entry has personnel_id
  IF NEW.personnel_id IS NOT NULL THEN
    UPDATE public.personnel_project_assignments
    SET last_time_entry_at = GREATEST(
      COALESCE(last_time_entry_at, '1970-01-01'::timestamptz),
      NEW.entry_date::timestamptz
    )
    WHERE project_id = NEW.project_id
      AND personnel_id = NEW.personnel_id
      AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on time_entries table for personnel assignments
DROP TRIGGER IF EXISTS update_personnel_assignment_on_time_entry ON public.time_entries;
CREATE TRIGGER update_personnel_assignment_on_time_entry
  AFTER INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_personnel_assignment_activity();