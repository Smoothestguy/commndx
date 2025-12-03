-- Create vendor_type enum
CREATE TYPE vendor_type AS ENUM ('contractor', 'personnel', 'supplier');

-- Add vendor_type column to vendors table with default value
ALTER TABLE vendors 
ADD COLUMN vendor_type vendor_type NOT NULL DEFAULT 'supplier';