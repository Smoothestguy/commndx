-- Add has_foreign_partners column for March 2024 W-9 revision (Line 3b)
ALTER TABLE personnel_w9_forms 
ADD COLUMN IF NOT EXISTS has_foreign_partners boolean DEFAULT false;