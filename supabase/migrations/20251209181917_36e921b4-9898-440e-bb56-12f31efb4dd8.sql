-- Create po_addendum_line_items table
CREATE TABLE public.po_addendum_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_addendum_id UUID NOT NULL REFERENCES public.po_addendums(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  markup NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.po_addendum_line_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins and managers can manage po addendum line items"
ON public.po_addendum_line_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view po addendum line items"
ON public.po_addendum_line_items
FOR SELECT
USING (true);

-- Add number and subtotal columns to po_addendums
ALTER TABLE public.po_addendums 
ADD COLUMN IF NOT EXISTS number TEXT,
ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;

-- Make file columns optional (allow NULL)
ALTER TABLE public.po_addendums 
ALTER COLUMN file_name DROP NOT NULL,
ALTER COLUMN file_path DROP NOT NULL,
ALTER COLUMN file_type DROP NOT NULL,
ALTER COLUMN file_size DROP NOT NULL;

-- Create function to generate addendum number
CREATE OR REPLACE FUNCTION generate_po_addendum_number(p_purchase_order_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(REPLACE(number, 'CO-', '') AS INTEGER)
  ), 0) + 1
  INTO next_number
  FROM public.po_addendums
  WHERE purchase_order_id = p_purchase_order_id
  AND number IS NOT NULL
  AND number LIKE 'CO-%';
  
  RETURN 'CO-' || next_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;