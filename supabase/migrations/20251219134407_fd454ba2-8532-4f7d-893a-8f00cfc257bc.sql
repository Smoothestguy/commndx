-- Add new status values to application_status enum
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'needs_info';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'updated';

-- Add new columns to applications table for edit functionality
ALTER TABLE applications ADD COLUMN IF NOT EXISTS edit_token TEXT UNIQUE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS edit_token_expires_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS missing_fields JSONB DEFAULT '[]';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS admin_message TEXT;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_applications_edit_token ON applications(edit_token) WHERE edit_token IS NOT NULL;

-- Create application_revisions table for audit trail
CREATE TABLE IF NOT EXISTS application_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL DEFAULT 1,
  previous_answers JSONB,
  previous_applicant_data JSONB,
  changed_fields JSONB DEFAULT '[]',
  changed_by TEXT DEFAULT 'applicant',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(application_id, revision_number)
);

-- Enable RLS on application_revisions
ALTER TABLE application_revisions ENABLE ROW LEVEL SECURITY;

-- Admins and managers can view revisions
CREATE POLICY "Admins and managers can view revisions" ON application_revisions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Public can insert revisions (for edit submissions)
CREATE POLICY "Public can insert revisions" ON application_revisions
  FOR INSERT WITH CHECK (true);