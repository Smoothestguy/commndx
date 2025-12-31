-- Add scope reference and source document links for auditable trail
ALTER TABLE change_orders 
ADD COLUMN IF NOT EXISTS scope_reference text;

ALTER TABLE change_orders 
ADD COLUMN IF NOT EXISTS source_estimate_id uuid REFERENCES estimates(id) ON DELETE SET NULL;

ALTER TABLE change_orders
ADD COLUMN IF NOT EXISTS source_job_order_id uuid REFERENCES job_orders(id) ON DELETE SET NULL;

-- Add original scope description to line items for per-line traceability
ALTER TABLE change_order_line_items
ADD COLUMN IF NOT EXISTS original_scope_description text;

-- Add comments for documentation
COMMENT ON COLUMN change_orders.scope_reference IS 'Required for deductive COs - describes what scope was removed and why';
COMMENT ON COLUMN change_orders.source_estimate_id IS 'Optional link to original estimate for audit trail';
COMMENT ON COLUMN change_orders.source_job_order_id IS 'Optional link to original job order for audit trail';
COMMENT ON COLUMN change_order_line_items.original_scope_description IS 'Reference to original scope item being modified/removed';