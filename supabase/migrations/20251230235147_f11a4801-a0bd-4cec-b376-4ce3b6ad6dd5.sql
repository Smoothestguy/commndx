-- Add invoiced_amount and remaining_amount columns to change_orders for partial invoicing
ALTER TABLE change_orders 
ADD COLUMN invoiced_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE change_orders 
ADD COLUMN remaining_amount numeric;

-- Initialize remaining_amount to match total for existing records
UPDATE change_orders 
SET remaining_amount = total 
WHERE remaining_amount IS NULL;

-- Make remaining_amount NOT NULL after initialization
ALTER TABLE change_orders 
ALTER COLUMN remaining_amount SET NOT NULL;

-- For already-invoiced Change Orders, set remaining_amount to 0 and invoiced_amount to total
UPDATE change_orders co
SET invoiced_amount = co.total, remaining_amount = 0
WHERE EXISTS (
  SELECT 1 FROM invoices i 
  WHERE i.change_order_id = co.id 
  AND i.deleted_at IS NULL
);