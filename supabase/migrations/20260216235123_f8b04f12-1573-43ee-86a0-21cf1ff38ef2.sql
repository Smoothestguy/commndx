
-- Add overhead tracking columns to time_entries
ALTER TABLE public.time_entries ADD COLUMN is_overhead boolean DEFAULT false;
ALTER TABLE public.time_entries ADD COLUMN overhead_category text;
