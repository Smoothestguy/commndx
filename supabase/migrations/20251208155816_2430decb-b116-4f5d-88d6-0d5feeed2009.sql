-- Create quickbooks_bill_mappings table to track synced vendor bills
CREATE TABLE public.quickbooks_bill_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.vendor_bills(id) ON DELETE CASCADE,
  quickbooks_bill_id text NOT NULL,
  quickbooks_doc_number text,
  sync_status text NOT NULL DEFAULT 'pending',
  last_synced_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(bill_id),
  UNIQUE(quickbooks_bill_id)
);

-- Enable RLS
ALTER TABLE public.quickbooks_bill_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and managers can manage bill mappings"
  ON public.quickbooks_bill_mappings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view bill mappings"
  ON public.quickbooks_bill_mappings FOR SELECT
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_quickbooks_bill_mappings_updated_at
  BEFORE UPDATE ON public.quickbooks_bill_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();