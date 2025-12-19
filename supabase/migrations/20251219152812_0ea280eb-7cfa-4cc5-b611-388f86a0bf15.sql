-- Add onboarding status columns to personnel table
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'pending';
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN personnel.onboarding_status IS 'Status of onboarding: pending, completed, expired';
COMMENT ON COLUMN personnel.onboarding_completed_at IS 'Timestamp when onboarding was completed';