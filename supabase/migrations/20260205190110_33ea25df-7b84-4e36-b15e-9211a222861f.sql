-- Add mandatory_payroll column to projects table
ALTER TABLE public.projects 
ADD COLUMN mandatory_payroll BOOLEAN DEFAULT false;