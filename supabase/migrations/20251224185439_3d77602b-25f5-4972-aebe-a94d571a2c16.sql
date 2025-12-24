-- Add clock settings to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS time_clock_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS require_clock_location boolean DEFAULT true;

-- Add clock and geolocation fields to time_entries table
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS clock_in_at timestamptz,
ADD COLUMN IF NOT EXISTS clock_out_at timestamptz,
ADD COLUMN IF NOT EXISTS clock_in_lat float8,
ADD COLUMN IF NOT EXISTS clock_in_lng float8,
ADD COLUMN IF NOT EXISTS clock_in_accuracy float8,
ADD COLUMN IF NOT EXISTS clock_out_lat float8,
ADD COLUMN IF NOT EXISTS clock_out_lng float8,
ADD COLUMN IF NOT EXISTS clock_out_accuracy float8,
ADD COLUMN IF NOT EXISTS entry_source text DEFAULT 'manual';

-- Add check constraint for entry_source
ALTER TABLE time_entries
ADD CONSTRAINT check_entry_source CHECK (entry_source IN ('manual', 'clock', 'admin_edit'));

-- Create partial unique index to prevent multiple open clock entries per personnel per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_clock_per_personnel_project 
ON time_entries (personnel_id, project_id) 
WHERE clock_in_at IS NOT NULL AND clock_out_at IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN time_entries.entry_source IS 'Source of entry: manual (default), clock (via clock in/out), admin_edit (manually edited by admin)';
COMMENT ON COLUMN projects.time_clock_enabled IS 'When true, personnel can clock in/out for this project';
COMMENT ON COLUMN projects.require_clock_location IS 'When true, location is required for clock in/out';