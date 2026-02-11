
-- Create qb_product_service_mappings table
CREATE TABLE public.qb_product_service_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  quickbooks_item_id TEXT,
  quickbooks_item_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.qb_product_service_mappings ENABLE ROW LEVEL SECURITY;

-- RLS: Staff can view active mappings
CREATE POLICY "Staff can view qb product mappings"
  ON public.qb_product_service_mappings
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'user')
  );

-- RLS: Only admins can manage mappings
CREATE POLICY "Admins can manage qb product mappings"
  ON public.qb_product_service_mappings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add qb_product_mapping_id to vendor_bill_line_items
ALTER TABLE public.vendor_bill_line_items
  ADD COLUMN qb_product_mapping_id UUID REFERENCES public.qb_product_service_mappings(id) ON DELETE SET NULL;

-- Add updated_at trigger for qb_product_service_mappings
CREATE TRIGGER update_qb_product_service_mappings_updated_at
  BEFORE UPDATE ON public.qb_product_service_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_qb_product_mappings_qb_item_id ON public.qb_product_service_mappings(quickbooks_item_id);
CREATE INDEX idx_vendor_bill_line_items_qb_mapping ON public.vendor_bill_line_items(qb_product_mapping_id);
