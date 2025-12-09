-- Add purchase order reference to vendor_bills
ALTER TABLE public.vendor_bills 
ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS purchase_order_number text;

-- Add billing tracking columns to purchase_orders
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS billed_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_closed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS closed_at timestamptz,
ADD COLUMN IF NOT EXISTS closed_by uuid;

-- Add billed quantity tracking to po_line_items
ALTER TABLE public.po_line_items 
ADD COLUMN IF NOT EXISTS billed_quantity numeric DEFAULT 0;

-- Add PO line item reference to vendor_bill_line_items
ALTER TABLE public.vendor_bill_line_items 
ADD COLUMN IF NOT EXISTS po_line_item_id uuid REFERENCES public.po_line_items(id) ON DELETE SET NULL;

-- Add new status values to purchase_order_status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'partially_billed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'purchase_order_status')) THEN
    ALTER TYPE public.purchase_order_status ADD VALUE 'partially_billed';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'fully_billed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'purchase_order_status')) THEN
    ALTER TYPE public.purchase_order_status ADD VALUE 'fully_billed';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'closed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'purchase_order_status')) THEN
    ALTER TYPE public.purchase_order_status ADD VALUE 'closed';
  END IF;
END $$;

-- Create function to update PO billing totals when vendor bill line items change
CREATE OR REPLACE FUNCTION public.update_po_billing_on_bill_line_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_id uuid;
  v_po_line_item_id uuid;
  v_total_billed numeric;
  v_po_total numeric;
  v_new_status purchase_order_status;
  v_is_closed boolean;
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
  
  -- Determine new status (only if not manually closed)
  IF v_is_closed THEN
    v_new_status := 'closed';
  ELSIF v_total_billed >= v_po_total THEN
    v_new_status := 'fully_billed';
  ELSIF v_total_billed > 0 THEN
    v_new_status := 'partially_billed';
  ELSE
    -- Keep current status if no billing yet
    SELECT status INTO v_new_status FROM public.purchase_orders WHERE id = v_po_id;
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
$$;

-- Create trigger for vendor_bill_line_items changes
DROP TRIGGER IF EXISTS update_po_billing_on_bill_line_item ON public.vendor_bill_line_items;
CREATE TRIGGER update_po_billing_on_bill_line_item
  AFTER INSERT OR UPDATE OR DELETE ON public.vendor_bill_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_po_billing_on_bill_line_item_change();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_vendor_bills_purchase_order_id ON public.vendor_bills(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_bill_line_items_po_line_item_id ON public.vendor_bill_line_items(po_line_item_id);