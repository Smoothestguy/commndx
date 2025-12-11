
-- Create T&M ticket status enum
CREATE TYPE public.tm_ticket_status AS ENUM ('draft', 'pending_signature', 'signed', 'approved', 'invoiced', 'void');

-- Create T&M tickets table
CREATE TABLE public.tm_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  vendor_id UUID REFERENCES public.vendors(id),
  purchase_order_id UUID REFERENCES public.purchase_orders(id),
  status public.tm_ticket_status NOT NULL DEFAULT 'draft',
  description TEXT,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_in_field BOOLEAN DEFAULT false,
  
  -- Signature fields
  customer_rep_name TEXT,
  customer_rep_title TEXT,
  customer_rep_email TEXT,
  signature_data TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  approval_token TEXT,
  
  -- Totals
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create T&M ticket line items table
CREATE TABLE public.tm_ticket_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tm_ticket_id UUID NOT NULL REFERENCES public.tm_tickets(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  markup NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  is_taxable BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add change_order_id to po_addendums for CO→PO linking
ALTER TABLE public.po_addendums 
ADD COLUMN IF NOT EXISTS change_order_id UUID REFERENCES public.change_orders(id);

-- Enable RLS
ALTER TABLE public.tm_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tm_ticket_line_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for tm_tickets
CREATE POLICY "Admins and managers can manage tm tickets" 
ON public.tm_tickets 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view tm tickets" 
ON public.tm_tickets 
FOR SELECT 
USING (true);

-- RLS policies for tm_ticket_line_items
CREATE POLICY "Admins and managers can manage tm ticket line items" 
ON public.tm_ticket_line_items 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view tm ticket line items" 
ON public.tm_ticket_line_items 
FOR SELECT 
USING (true);

-- Function to generate T&M ticket number
CREATE OR REPLACE FUNCTION public.generate_tm_ticket_number(p_project_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(REPLACE(ticket_number, 'TM-', '') AS INTEGER)
  ), 0) + 1
  INTO next_number
  FROM public.tm_tickets
  WHERE project_id = p_project_id;
  
  RETURN 'TM-' || next_number;
END;
$function$;

-- Trigger to auto-set ticket number
CREATE OR REPLACE FUNCTION public.set_tm_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := public.generate_tm_ticket_number(NEW.project_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER set_tm_ticket_number_trigger
BEFORE INSERT ON public.tm_tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_tm_ticket_number();

-- Update timestamp trigger
CREATE TRIGGER update_tm_tickets_updated_at
BEFORE UPDATE ON public.tm_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_tm_tickets_project_id ON public.tm_tickets(project_id);
CREATE INDEX idx_tm_tickets_status ON public.tm_tickets(status);
CREATE INDEX idx_tm_ticket_line_items_ticket_id ON public.tm_ticket_line_items(tm_ticket_id);
CREATE INDEX idx_po_addendums_change_order_id ON public.po_addendums(change_order_id);
