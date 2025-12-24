-- Drop the old constraint that requires hours > 0
ALTER TABLE public.time_entries DROP CONSTRAINT IF EXISTS time_entries_hours_check;

-- Add the new constraint allowing zero hours (for in-progress entries)
ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_hours_check 
  CHECK ((hours >= 0) AND (hours <= 24));