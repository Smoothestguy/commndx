-- Create enum for item types
CREATE TYPE item_type AS ENUM ('product', 'service', 'labor');

-- Add item_type column with default 'product'
ALTER TABLE products ADD COLUMN item_type item_type NOT NULL DEFAULT 'product';

-- Add SKU field (common in QuickBooks for products)
ALTER TABLE products ADD COLUMN sku text;