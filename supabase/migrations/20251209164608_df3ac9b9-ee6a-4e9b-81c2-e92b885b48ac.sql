-- Update the trigger function to auto-reopen POs when all bills are deleted
CREATE OR REPLACE FUNCTION public.update_po_billing_on_bill_line_item_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_po_id uuid;
  v_po_line_item_id uuid;
  v_total_billed numeric;
  v_po_total numeric;
  v_new_status purchase_order_status;
  v_is_closed boolean;
  v_all_items_fulfilled boolean;
BEGIN
  -- Get the po_line_item_id based on operation
  IF TG_OP = 'DELETE' THEN
    v_po_line_item_id := OLD.po_line_item_id;
  ELSE
    v_po_line_item_id := NEW.po_line_item_id;
  END IF;
  
  -- If no PO line item linked, skip
  IF v_po_line_item_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  
  -- Get the PO ID from the line item
  SELECT pli.purchase_order_id INTO v_po_id
  FROM public.po_line_items pli
  WHERE pli.id = v_po_line_item_id;
  
  -- Update billed_quantity on po_line_items
  UPDATE public.po_line_items pli
  SET billed_quantity = COALESCE((
    SELECT SUM(vbli.quantity)
    FROM public.vendor_bill_line_items vbli
    WHERE vbli.po_line_item_id = pli.id
  ), 0)
  WHERE pli.id = v_po_line_item_id;
  
  -- Calculate total billed amount for the PO
  SELECT COALESCE(SUM(vbli.total), 0) INTO v_total_billed
  FROM public.vendor_bill_line_items vbli
  INNER JOIN public.po_line_items pli ON vbli.po_line_item_id = pli.id
  WHERE pli.purchase_order_id = v_po_id;
  
  -- Get PO total and closed status
  SELECT total, is_closed INTO v_po_total, v_is_closed
  FROM public.purchase_orders
  WHERE id = v_po_id;
  
  -- Check if all line items are fully billed (fulfilled)
  SELECT NOT EXISTS (
    SELECT 1 FROM public.po_line_items
    WHERE purchase_order_id = v_po_id
    AND billed_quantity < quantity
  ) INTO v_all_items_fulfilled;
  
  -- Determine new status based on billing state
  IF v_total_billed = 0 THEN
    -- No bills remaining - reopen the PO (reset auto-closed state)
    v_new_status := 'sent';
    -- Reset is_closed flag since there's nothing billed
    UPDATE public.purchase_orders
    SET is_closed = false
    WHERE id = v_po_id AND is_closed = true;
  ELSIF v_is_closed THEN
    -- Manually closed POs with bills stay closed
    v_new_status := 'closed';
  ELSIF v_all_items_fulfilled AND v_total_billed >= v_po_total THEN
    -- All items fully billed - auto-close the PO
    v_new_status := 'closed';
    UPDATE public.purchase_orders
    SET is_closed = true
    WHERE id = v_po_id AND NOT is_closed;
  ELSIF v_total_billed >= v_po_total THEN
    v_new_status := 'fully_billed';
  ELSIF v_total_billed > 0 THEN
    v_new_status := 'partially_billed';
  ELSE
    v_new_status := 'sent';
  END IF;
  
  -- Update the purchase order
  UPDATE public.purchase_orders
  SET billed_amount = v_total_billed,
      status = v_new_status,
      updated_at = now()
  WHERE id = v_po_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;