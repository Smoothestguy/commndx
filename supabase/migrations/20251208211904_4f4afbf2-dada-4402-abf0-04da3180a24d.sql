-- Add created_by column to estimates table to track who created the estimate
ALTER TABLE public.estimates 
ADD COLUMN created_by uuid REFERENCES auth.users(id);