-- Add jobsite_address column to estimates table
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS jobsite_address text;