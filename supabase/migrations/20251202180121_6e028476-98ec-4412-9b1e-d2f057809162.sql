-- Add new columns to roof_measurements table for comprehensive measurement tracking
ALTER TABLE roof_measurements ADD COLUMN IF NOT EXISTS total_roof_area numeric;
ALTER TABLE roof_measurements ADD COLUMN IF NOT EXISTS total_pitched_area numeric;
ALTER TABLE roof_measurements ADD COLUMN IF NOT EXISTS total_flat_area numeric;
ALTER TABLE roof_measurements ADD COLUMN IF NOT EXISTS total_facets integer;
ALTER TABLE roof_measurements ADD COLUMN IF NOT EXISTS hips_length numeric;
ALTER TABLE roof_measurements ADD COLUMN IF NOT EXISTS rakes_length numeric;
ALTER TABLE roof_measurements ADD COLUMN IF NOT EXISTS wall_flashing_length numeric;
ALTER TABLE roof_measurements ADD COLUMN IF NOT EXISTS step_flashing_length numeric;
ALTER TABLE roof_measurements ADD COLUMN IF NOT EXISTS transitions_length numeric;
ALTER TABLE roof_measurements ADD COLUMN IF NOT EXISTS parapet_wall_length numeric;
ALTER TABLE roof_measurements ADD COLUMN IF NOT EXISTS unspecified_length numeric;