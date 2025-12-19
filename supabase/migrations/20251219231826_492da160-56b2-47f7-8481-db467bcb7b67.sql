-- Add geolocation and timestamp columns to applications table
ALTER TABLE public.applications 
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS client_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geo_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geo_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geo_accuracy DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geo_source TEXT,
  ADD COLUMN IF NOT EXISTS geo_captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geo_error TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS submitted_by_user_id UUID REFERENCES auth.users(id);

-- Add index for location-based queries
CREATE INDEX IF NOT EXISTS idx_applications_geo ON public.applications (geo_lat, geo_lng) WHERE geo_lat IS NOT NULL;