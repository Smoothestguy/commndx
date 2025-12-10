-- Create QuickBooks estimate mappings table
CREATE TABLE IF NOT EXISTS public.quickbooks_estimate_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  quickbooks_estimate_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(estimate_id),
  UNIQUE(quickbooks_estimate_id)
);

-- Create QuickBooks purchase order mappings table
CREATE TABLE IF NOT EXISTS public.quickbooks_po_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  quickbooks_po_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(purchase_order_id),
  UNIQUE(quickbooks_po_id)
);

-- Enable RLS
ALTER TABLE public.quickbooks_estimate_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quickbooks_po_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for estimate mappings
CREATE POLICY "Authenticated users can view estimate mappings"
ON public.quickbooks_estimate_mappings
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert estimate mappings"
ON public.quickbooks_estimate_mappings
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update estimate mappings"
ON public.quickbooks_estimate_mappings
FOR UPDATE
USING (auth.role() = 'authenticated');

-- RLS policies for PO mappings
CREATE POLICY "Authenticated users can view PO mappings"
ON public.quickbooks_po_mappings
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert PO mappings"
ON public.quickbooks_po_mappings
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update PO mappings"
ON public.quickbooks_po_mappings
FOR UPDATE
USING (auth.role() = 'authenticated');

-- Add triggers for updated_at
CREATE TRIGGER update_quickbooks_estimate_mappings_updated_at
BEFORE UPDATE ON public.quickbooks_estimate_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quickbooks_po_mappings_updated_at
BEFORE UPDATE ON public.quickbooks_po_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();