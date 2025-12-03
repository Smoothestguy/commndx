-- Create sync status enum
CREATE TYPE quickbooks_sync_status AS ENUM ('synced', 'pending', 'conflict', 'error');

-- QuickBooks OAuth configuration table
CREATE TABLE public.quickbooks_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id text UNIQUE,
  access_token text,
  refresh_token text,
  token_expires_at timestamp with time zone,
  company_name text,
  is_connected boolean DEFAULT false,
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- QuickBooks product mappings
CREATE TABLE public.quickbooks_product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quickbooks_item_id text NOT NULL,
  sync_status quickbooks_sync_status DEFAULT 'pending',
  last_synced_at timestamp with time zone,
  sync_direction text DEFAULT 'bidirectional',
  conflict_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(product_id),
  UNIQUE(quickbooks_item_id)
);

-- QuickBooks customer mappings
CREATE TABLE public.quickbooks_customer_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  quickbooks_customer_id text NOT NULL,
  sync_status quickbooks_sync_status DEFAULT 'pending',
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(customer_id),
  UNIQUE(quickbooks_customer_id)
);

-- QuickBooks invoice mappings
CREATE TABLE public.quickbooks_invoice_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  quickbooks_invoice_id text NOT NULL,
  quickbooks_doc_number text,
  sync_status quickbooks_sync_status DEFAULT 'pending',
  synced_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(invoice_id),
  UNIQUE(quickbooks_invoice_id)
);

-- QuickBooks sync log for audit trail
CREATE TABLE public.quickbooks_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  quickbooks_id text,
  action text NOT NULL,
  status text NOT NULL,
  error_message text,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.quickbooks_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quickbooks_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quickbooks_customer_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quickbooks_invoice_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quickbooks_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for quickbooks_config
CREATE POLICY "Admins can manage quickbooks config"
  ON public.quickbooks_config FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view quickbooks config"
  ON public.quickbooks_config FOR SELECT
  USING (true);

-- RLS policies for quickbooks_product_mappings
CREATE POLICY "Admins and managers can manage product mappings"
  ON public.quickbooks_product_mappings FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view product mappings"
  ON public.quickbooks_product_mappings FOR SELECT
  USING (true);

-- RLS policies for quickbooks_customer_mappings
CREATE POLICY "Admins and managers can manage customer mappings"
  ON public.quickbooks_customer_mappings FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view customer mappings"
  ON public.quickbooks_customer_mappings FOR SELECT
  USING (true);

-- RLS policies for quickbooks_invoice_mappings
CREATE POLICY "Admins and managers can manage invoice mappings"
  ON public.quickbooks_invoice_mappings FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view invoice mappings"
  ON public.quickbooks_invoice_mappings FOR SELECT
  USING (true);

-- RLS policies for quickbooks_sync_log
CREATE POLICY "Admins and managers can view sync logs"
  ON public.quickbooks_sync_log FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "System can insert sync logs"
  ON public.quickbooks_sync_log FOR INSERT
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_qb_product_mappings_product_id ON public.quickbooks_product_mappings(product_id);
CREATE INDEX idx_qb_product_mappings_qb_id ON public.quickbooks_product_mappings(quickbooks_item_id);
CREATE INDEX idx_qb_customer_mappings_customer_id ON public.quickbooks_customer_mappings(customer_id);
CREATE INDEX idx_qb_customer_mappings_qb_id ON public.quickbooks_customer_mappings(quickbooks_customer_id);
CREATE INDEX idx_qb_invoice_mappings_invoice_id ON public.quickbooks_invoice_mappings(invoice_id);
CREATE INDEX idx_qb_sync_log_entity ON public.quickbooks_sync_log(entity_type, entity_id);
CREATE INDEX idx_qb_sync_log_created ON public.quickbooks_sync_log(created_at DESC);

-- Add triggers for updated_at
CREATE TRIGGER update_quickbooks_config_updated_at
  BEFORE UPDATE ON public.quickbooks_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quickbooks_product_mappings_updated_at
  BEFORE UPDATE ON public.quickbooks_product_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quickbooks_customer_mappings_updated_at
  BEFORE UPDATE ON public.quickbooks_customer_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quickbooks_invoice_mappings_updated_at
  BEFORE UPDATE ON public.quickbooks_invoice_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();