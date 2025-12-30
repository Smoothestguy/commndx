-- Add portal_required column to personnel table
-- Default to true (most workers need portal access)
ALTER TABLE personnel ADD COLUMN portal_required boolean DEFAULT true;

COMMENT ON COLUMN personnel.portal_required IS 'Whether this personnel requires portal access. False for temporary/day workers.';