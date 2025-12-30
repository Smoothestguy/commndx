-- Add edit permission columns to personnel_w9_forms
ALTER TABLE personnel_w9_forms 
  ADD COLUMN IF NOT EXISTS edit_allowed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS edit_allowed_until TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN personnel_w9_forms.edit_allowed IS 'Whether personnel is allowed to edit their W-9 form';
COMMENT ON COLUMN personnel_w9_forms.edit_allowed_until IS 'Expiration time for edit permission';