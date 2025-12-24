-- Add lunch break columns to time_entries table
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS lunch_start_at timestamptz,
ADD COLUMN IF NOT EXISTS lunch_end_at timestamptz,
ADD COLUMN IF NOT EXISTS lunch_duration_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_on_lunch boolean DEFAULT false;