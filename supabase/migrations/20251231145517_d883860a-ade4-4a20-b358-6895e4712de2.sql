-- Add default value to remaining_amount column as a safety net
ALTER TABLE change_orders 
ALTER COLUMN remaining_amount SET DEFAULT 0;