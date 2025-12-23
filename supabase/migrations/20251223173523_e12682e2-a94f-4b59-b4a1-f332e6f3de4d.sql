-- Add product_name column to estimate_line_items for storing product name separately from description
ALTER TABLE estimate_line_items 
ADD COLUMN product_name text;