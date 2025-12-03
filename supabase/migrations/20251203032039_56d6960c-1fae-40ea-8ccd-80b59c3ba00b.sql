-- Add text color columns to badge_templates
ALTER TABLE badge_templates 
ADD COLUMN IF NOT EXISTS name_color TEXT DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS personnel_number_color TEXT DEFAULT '#ea580c',
ADD COLUMN IF NOT EXISTS label_color TEXT DEFAULT '#374151',
ADD COLUMN IF NOT EXISTS value_color TEXT DEFAULT '#1f2937',
ADD COLUMN IF NOT EXISTS footer_color TEXT DEFAULT '#6b7280';