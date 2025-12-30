-- Fix vendor_bill_line_items FK to SET NULL on delete (allows addendum deletion)
ALTER TABLE vendor_bill_line_items 
  DROP CONSTRAINT IF EXISTS vendor_bill_line_items_po_addendum_line_item_id_fkey;

ALTER TABLE vendor_bill_line_items 
  ADD CONSTRAINT vendor_bill_line_items_po_addendum_line_item_id_fkey 
  FOREIGN KEY (po_addendum_line_item_id) 
  REFERENCES po_addendum_line_items(id) 
  ON DELETE SET NULL;

-- Allow PO line items to cascade delete when PO is deleted
ALTER TABLE po_line_items 
  DROP CONSTRAINT IF EXISTS po_line_items_purchase_order_id_fkey;

ALTER TABLE po_line_items 
  ADD CONSTRAINT po_line_items_purchase_order_id_fkey 
  FOREIGN KEY (purchase_order_id) 
  REFERENCES purchase_orders(id) 
  ON DELETE CASCADE;

-- Allow addendums to cascade delete when PO is deleted
ALTER TABLE po_addendums 
  DROP CONSTRAINT IF EXISTS po_addendums_purchase_order_id_fkey;

ALTER TABLE po_addendums 
  ADD CONSTRAINT po_addendums_purchase_order_id_fkey 
  FOREIGN KEY (purchase_order_id) 
  REFERENCES purchase_orders(id) 
  ON DELETE CASCADE;

-- Allow addendum line items to cascade delete when addendum is deleted
ALTER TABLE po_addendum_line_items 
  DROP CONSTRAINT IF EXISTS po_addendum_line_items_po_addendum_id_fkey;

ALTER TABLE po_addendum_line_items 
  ADD CONSTRAINT po_addendum_line_items_po_addendum_id_fkey 
  FOREIGN KEY (po_addendum_id) 
  REFERENCES po_addendums(id) 
  ON DELETE CASCADE;