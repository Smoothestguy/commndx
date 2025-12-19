-- Add home location columns to personnel table for map view
ALTER TABLE public.personnel 
  ADD COLUMN IF NOT EXISTS home_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS home_lng DOUBLE PRECISION;

-- Add index for location-based queries on personnel
CREATE INDEX IF NOT EXISTS idx_personnel_location ON public.personnel (home_lat, home_lng) WHERE home_lat IS NOT NULL;