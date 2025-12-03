-- Create quickbooks_vendor_mappings table for vendor sync
CREATE TABLE public.quickbooks_vendor_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  quickbooks_vendor_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  sync_direction TEXT,
  last_synced_at TIMESTAMPTZ,
  conflict_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vendor_id),
  UNIQUE(quickbooks_vendor_id)
);

-- Enable RLS
ALTER TABLE public.quickbooks_vendor_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and managers can manage vendor mappings"
  ON public.quickbooks_vendor_mappings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view vendor mappings"
  ON public.quickbooks_vendor_mappings FOR SELECT
  USING (true);

-- Add update trigger
CREATE TRIGGER update_quickbooks_vendor_mappings_updated_at
  BEFORE UPDATE ON public.quickbooks_vendor_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();