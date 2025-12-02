-- Add pricing_type column to estimate_line_items to allow markup or margin calculation
ALTER TABLE estimate_line_items 
ADD COLUMN IF NOT EXISTS pricing_type text DEFAULT 'margin';

-- Add default_pricing_type to estimates table for setting defaults per estimate
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS default_pricing_type text DEFAULT 'margin';