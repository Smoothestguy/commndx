-- Add column to link approved registrations to personnel records
ALTER TABLE personnel_registrations 
ADD COLUMN IF NOT EXISTS personnel_id UUID REFERENCES personnel(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_personnel_registrations_personnel_id 
ON personnel_registrations(personnel_id);