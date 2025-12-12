-- Create vendor_bill_payment_attachments table
CREATE TABLE public.vendor_bill_payment_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.vendor_bill_payments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice_payment_attachments table
CREATE TABLE public.invoice_payment_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.invoice_payments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_bill_payment_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payment_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for vendor_bill_payment_attachments
CREATE POLICY "Admins and managers can manage vendor bill payment attachments"
ON public.vendor_bill_payment_attachments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view vendor bill payment attachments"
ON public.vendor_bill_payment_attachments
FOR SELECT
USING (true);

-- RLS policies for invoice_payment_attachments
CREATE POLICY "Admins and managers can manage invoice payment attachments"
ON public.invoice_payment_attachments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view invoice payment attachments"
ON public.invoice_payment_attachments
FOR SELECT
USING (true);