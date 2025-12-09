-- Add jo_line_item_id to invoice_line_items to track which job order line item is being invoiced
ALTER TABLE public.invoice_line_items
ADD COLUMN jo_line_item_id uuid REFERENCES public.job_order_line_items(id);

-- Add invoiced_quantity to job_order_line_items to track how much has been invoiced
ALTER TABLE public.job_order_line_items
ADD COLUMN invoiced_quantity numeric DEFAULT 0;

-- Create function to update invoiced_quantity when invoice line items change
CREATE OR REPLACE FUNCTION public.update_jo_invoicing_on_invoice_line_item_change()
RETURNS TRIGGER AS $$
DECLARE
  v_jo_line_item_id uuid;
BEGIN
  -- Get the jo_line_item_id based on operation
  IF TG_OP = 'DELETE' THEN
    v_jo_line_item_id := OLD.jo_line_item_id;
  ELSE
    v_jo_line_item_id := NEW.jo_line_item_id;
  END IF;
  
  -- If no JO line item linked, skip
  IF v_jo_line_item_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  
  -- Update invoiced_quantity on jo_line_items
  UPDATE public.job_order_line_items
  SET invoiced_quantity = COALESCE((
    SELECT SUM(quantity)
    FROM public.invoice_line_items
    WHERE jo_line_item_id = v_jo_line_item_id
  ), 0)
  WHERE id = v_jo_line_item_id;
  
  -- Handle old jo_line_item_id on UPDATE if it changed
  IF TG_OP = 'UPDATE' AND OLD.jo_line_item_id IS DISTINCT FROM NEW.jo_line_item_id AND OLD.jo_line_item_id IS NOT NULL THEN
    UPDATE public.job_order_line_items
    SET invoiced_quantity = COALESCE((
      SELECT SUM(quantity)
      FROM public.invoice_line_items
      WHERE jo_line_item_id = OLD.jo_line_item_id
    ), 0)
    WHERE id = OLD.jo_line_item_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for invoice line item changes
CREATE TRIGGER update_jo_invoicing_on_invoice_line_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
FOR EACH ROW
EXECUTE FUNCTION public.update_jo_invoicing_on_invoice_line_item_change();