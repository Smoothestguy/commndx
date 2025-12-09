-- Create enum for change order status
CREATE TYPE public.change_order_status AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'invoiced'
);

-- Create change_orders table
CREATE TABLE public.change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  job_order_id UUID REFERENCES public.job_orders(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name TEXT,
  status public.change_order_status NOT NULL DEFAULT 'draft',
  reason TEXT NOT NULL,
  description TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size BIGINT,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create change_order_line_items table
CREATE TABLE public.change_order_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID NOT NULL REFERENCES public.change_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  markup NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  is_taxable BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create link table for change orders to vendor bills
CREATE TABLE public.change_order_vendor_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID NOT NULL REFERENCES public.change_orders(id) ON DELETE CASCADE,
  vendor_bill_id UUID NOT NULL REFERENCES public.vendor_bills(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(change_order_id, vendor_bill_id)
);

-- Add change_order_id column to invoices table
ALTER TABLE public.invoices ADD COLUMN change_order_id UUID REFERENCES public.change_orders(id) ON DELETE SET NULL;

-- Function to generate change order number per project
CREATE OR REPLACE FUNCTION public.generate_change_order_number(p_project_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(REPLACE(number, 'CO-', '') AS INTEGER)
  ), 0) + 1
  INTO next_number
  FROM public.change_orders
  WHERE project_id = p_project_id;
  
  RETURN 'CO-' || next_number;
END;
$$;

-- Trigger function to set change order number on insert
CREATE OR REPLACE FUNCTION public.set_change_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := public.generate_change_order_number(NEW.project_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER set_change_order_number_trigger
BEFORE INSERT ON public.change_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_change_order_number();

-- Enable RLS
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_order_vendor_bills ENABLE ROW LEVEL SECURITY;

-- RLS policies for change_orders
CREATE POLICY "Admins and managers can manage change orders"
ON public.change_orders FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view change orders"
ON public.change_orders FOR SELECT
USING (true);

-- RLS policies for change_order_line_items
CREATE POLICY "Admins and managers can manage change order line items"
ON public.change_order_line_items FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view change order line items"
ON public.change_order_line_items FOR SELECT
USING (true);

-- RLS policies for change_order_vendor_bills
CREATE POLICY "Admins and managers can manage change order vendor bills"
ON public.change_order_vendor_bills FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view change order vendor bills"
ON public.change_order_vendor_bills FOR SELECT
USING (true);

-- Create indexes
CREATE INDEX idx_change_orders_project_id ON public.change_orders(project_id);
CREATE INDEX idx_change_orders_status ON public.change_orders(status);
CREATE INDEX idx_change_orders_purchase_order_id ON public.change_orders(purchase_order_id);
CREATE INDEX idx_change_orders_job_order_id ON public.change_orders(job_order_id);
CREATE INDEX idx_change_order_line_items_change_order_id ON public.change_order_line_items(change_order_id);
CREATE INDEX idx_change_order_vendor_bills_change_order_id ON public.change_order_vendor_bills(change_order_id);
CREATE INDEX idx_invoices_change_order_id ON public.invoices(change_order_id);