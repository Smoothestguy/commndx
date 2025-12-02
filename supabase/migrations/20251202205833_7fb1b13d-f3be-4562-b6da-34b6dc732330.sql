-- Add new columns for employment verification
ALTER TABLE personnel_registrations
ADD COLUMN IF NOT EXISTS ssn_full TEXT,
ADD COLUMN IF NOT EXISTS citizenship_status TEXT,
ADD COLUMN IF NOT EXISTS immigration_status TEXT;

-- Add check constraints
ALTER TABLE personnel_registrations
ADD CONSTRAINT citizenship_status_check CHECK (citizenship_status IS NULL OR citizenship_status IN ('us_citizen', 'non_us_citizen'));

ALTER TABLE personnel_registrations
ADD CONSTRAINT immigration_status_check CHECK (immigration_status IS NULL OR immigration_status IN ('visa', 'work_permit', 'green_card', 'other'));

-- Also add these columns to personnel table for when registration is approved
ALTER TABLE personnel
ADD COLUMN IF NOT EXISTS ssn_full TEXT,
ADD COLUMN IF NOT EXISTS citizenship_status TEXT,
ADD COLUMN IF NOT EXISTS immigration_status TEXT;

ALTER TABLE personnel
ADD CONSTRAINT personnel_citizenship_status_check CHECK (citizenship_status IS NULL OR citizenship_status IN ('us_citizen', 'non_us_citizen'));

ALTER TABLE personnel
ADD CONSTRAINT personnel_immigration_status_check CHECK (immigration_status IS NULL OR immigration_status IN ('visa', 'work_permit', 'green_card', 'other'));