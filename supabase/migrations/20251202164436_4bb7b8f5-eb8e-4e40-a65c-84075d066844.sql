-- Add is_holiday column to time_entries table
ALTER TABLE public.time_entries 
ADD COLUMN is_holiday boolean DEFAULT false;

-- Add holiday_multiplier to company_settings table
ALTER TABLE public.company_settings 
ADD COLUMN holiday_multiplier numeric DEFAULT 1.5;