
-- Add billed_quantity to job_order_line_items
ALTER TABLE public.job_order_line_items 
ADD COLUMN IF NOT EXISTS billed_quantity numeric DEFAULT 0;

-- Add jo_line_item_id to vendor_bill_line_items
ALTER TABLE public.vendor_bill_line_items 
ADD COLUMN IF NOT EXISTS jo_line_item_id uuid REFERENCES public.job_order_line_items(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_vbli_jo_line_item_id 
ON public.vendor_bill_line_items(jo_line_item_id);

-- Trigger to auto-update JO billed_quantity
CREATE OR REPLACE FUNCTION public.update_jo_billing_on_vendor_bill_change()
RETURNS trigger AS $$
DECLARE
  v_jo_line_item_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_jo_line_item_id := OLD.jo_line_item_id;
  ELSE
    v_jo_line_item_id := NEW.jo_line_item_id;
  END IF;

  IF v_jo_line_item_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  UPDATE public.job_order_line_items
  SET billed_quantity = COALESCE((
    SELECT SUM(quantity) FROM public.vendor_bill_line_items
    WHERE jo_line_item_id = v_jo_line_item_id
  ), 0)
  WHERE id = v_jo_line_item_id;

  -- Handle old jo_line_item_id on UPDATE if changed
  IF TG_OP = 'UPDATE' AND OLD.jo_line_item_id IS DISTINCT FROM NEW.jo_line_item_id 
     AND OLD.jo_line_item_id IS NOT NULL THEN
    UPDATE public.job_order_line_items
    SET billed_quantity = COALESCE((
      SELECT SUM(quantity) FROM public.vendor_bill_line_items
      WHERE jo_line_item_id = OLD.jo_line_item_id
    ), 0)
    WHERE id = OLD.jo_line_item_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trigger_update_jo_billing_on_vendor_bill
  AFTER INSERT OR UPDATE OR DELETE ON public.vendor_bill_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_jo_billing_on_vendor_bill_change();
