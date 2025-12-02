-- Add tax_exempt to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_exempt boolean DEFAULT false;

-- Add is_taxable to products table (labor services can be non-taxable)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_taxable boolean DEFAULT true;

-- Add is_taxable to estimate_line_items table for per-item override
ALTER TABLE estimate_line_items ADD COLUMN IF NOT EXISTS is_taxable boolean DEFAULT true;