-- Add structured address fields to applicants table
ALTER TABLE public.applicants
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text;

-- Add geocode metadata to applicants
ALTER TABLE public.applicants
ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
ADD COLUMN IF NOT EXISTS geocode_source text,
ADD COLUMN IF NOT EXISTS is_geocodable boolean DEFAULT true;

-- Add geocode metadata to personnel
ALTER TABLE public.personnel
ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
ADD COLUMN IF NOT EXISTS geocode_source text,
ADD COLUMN IF NOT EXISTS is_geocodable boolean DEFAULT true;

-- Create geocode logs table for tracking failures
CREATE TABLE IF NOT EXISTS public.geocode_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  record_type text NOT NULL CHECK (record_type IN ('personnel', 'applicant')),
  record_id uuid NOT NULL,
  address_input text,
  success boolean NOT NULL,
  error_message text,
  lat double precision,
  lng double precision,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on geocode_logs
ALTER TABLE public.geocode_logs ENABLE ROW LEVEL SECURITY;

-- Admins and managers can view all logs
CREATE POLICY "Admins and managers can view geocode logs"
ON public.geocode_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Allow insert from edge functions (service role)
CREATE POLICY "Service role can insert geocode logs"
ON public.geocode_logs
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_geocode_logs_record ON public.geocode_logs(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_geocode_logs_created_at ON public.geocode_logs(created_at DESC);