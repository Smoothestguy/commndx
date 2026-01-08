-- Add idle correction tracking columns to user_work_sessions
ALTER TABLE public.user_work_sessions 
ADD COLUMN IF NOT EXISTS idle_correction_version integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS idle_corrected_at timestamptz NULL;