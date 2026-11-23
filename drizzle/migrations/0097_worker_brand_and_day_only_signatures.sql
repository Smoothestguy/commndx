ALTER TABLE public.project_locations ADD COLUMN IF NOT EXISTS worker_brand_name text;
COMMENT ON COLUMN public.project_locations.worker_brand_name IS 'Optional company name shown to workers on signature texts/pages for this location; null keeps default branding.';
ALTER TABLE public.timesheet_signature_requests ADD COLUMN IF NOT EXISTS show_times boolean NOT NULL DEFAULT true;