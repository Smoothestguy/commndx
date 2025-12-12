-- Add billed_quantity column to po_addendum_line_items to track how much has been billed
ALTER TABLE po_addendum_line_items 
ADD COLUMN IF NOT EXISTS billed_quantity numeric NOT NULL DEFAULT 0;

-- Add po_addendum_line_item_id to vendor_bill_line_items to track which addendum item was billed
ALTER TABLE vendor_bill_line_items 
ADD COLUMN IF NOT EXISTS po_addendum_line_item_id uuid REFERENCES po_addendum_line_items(id);

-- Create trigger function to update addendum line item billed quantities
CREATE OR REPLACE FUNCTION public.update_po_addendum_billing_on_bill_line_item_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_addendum_line_item_id uuid;
BEGIN
  -- Get the addendum line item id based on operation
  IF TG_OP = 'DELETE' THEN
    v_addendum_line_item_id := OLD.po_addendum_line_item_id;
  ELSE
    v_addendum_line_item_id := NEW.po_addendum_line_item_id;
  END IF;
  
  -- If no addendum line item linked, skip
  IF v_addendum_line_item_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  
  -- Update billed_quantity on po_addendum_line_items
  UPDATE public.po_addendum_line_items
  SET billed_quantity = COALESCE((
    SELECT SUM(vbli.quantity)
    FROM public.vendor_bill_line_items vbli
    WHERE vbli.po_addendum_line_item_id = po_addendum_line_items.id
  ), 0)
  WHERE id = v_addendum_line_item_id;
  
  -- Handle old addendum line item id on UPDATE if it changed
  IF TG_OP = 'UPDATE' AND OLD.po_addendum_line_item_id IS DISTINCT FROM NEW.po_addendum_line_item_id AND OLD.po_addendum_line_item_id IS NOT NULL THEN
    UPDATE public.po_addendum_line_items
    SET billed_quantity = COALESCE((
      SELECT SUM(vbli.quantity)
      FROM public.vendor_bill_line_items vbli
      WHERE vbli.po_addendum_line_item_id = OLD.po_addendum_line_item_id
    ), 0)
    WHERE id = OLD.po_addendum_line_item_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger for addendum line item billing updates
DROP TRIGGER IF EXISTS update_po_addendum_billing_on_insert ON vendor_bill_line_items;
DROP TRIGGER IF EXISTS update_po_addendum_billing_on_update ON vendor_bill_line_items;
DROP TRIGGER IF EXISTS update_po_addendum_billing_on_delete ON vendor_bill_line_items;

CREATE TRIGGER update_po_addendum_billing_on_insert
AFTER INSERT ON vendor_bill_line_items
FOR EACH ROW
EXECUTE FUNCTION update_po_addendum_billing_on_bill_line_item_change();

CREATE TRIGGER update_po_addendum_billing_on_update
AFTER UPDATE ON vendor_bill_line_items
FOR EACH ROW
EXECUTE FUNCTION update_po_addendum_billing_on_bill_line_item_change();

CREATE TRIGGER update_po_addendum_billing_on_delete
AFTER DELETE ON vendor_bill_line_items
FOR EACH ROW
EXECUTE FUNCTION update_po_addendum_billing_on_bill_line_item_change();