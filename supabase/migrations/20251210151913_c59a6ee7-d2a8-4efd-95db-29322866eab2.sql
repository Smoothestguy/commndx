-- Add partially_paid to invoice_status enum
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'partially_paid' AFTER 'sent';

-- Add payment tracking columns to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC NOT NULL DEFAULT 0;

-- Update existing invoices to set remaining_amount = total
UPDATE public.invoices SET remaining_amount = total WHERE remaining_amount = 0 AND status != 'paid';

-- Update paid invoices to have correct amounts
UPDATE public.invoices SET paid_amount = total, remaining_amount = 0 WHERE status = 'paid';

-- Create invoice_payments table
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Check',
  reference_number TEXT,
  notes TEXT,
  quickbooks_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on invoice_payments
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoice_payments
CREATE POLICY "Admins and managers can manage invoice payments"
ON public.invoice_payments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view invoice payments"
ON public.invoice_payments
FOR SELECT
USING (true);

-- Create trigger function to auto-update invoice payment totals
CREATE OR REPLACE FUNCTION public.update_invoice_payment_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_paid NUMERIC;
  invoice_total NUMERIC;
  new_status public.invoice_status;
BEGIN
  -- Get the invoice_id depending on operation
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM public.invoice_payments
    WHERE invoice_id = OLD.invoice_id;
    
    SELECT total INTO invoice_total FROM public.invoices WHERE id = OLD.invoice_id;
    
    -- Determine new status
    IF total_paid = 0 THEN
      new_status := 'sent';
    ELSIF total_paid >= invoice_total THEN
      new_status := 'paid';
    ELSE
      new_status := 'partially_paid';
    END IF;
    
    UPDATE public.invoices
    SET paid_amount = total_paid,
        remaining_amount = invoice_total - total_paid,
        status = new_status,
        paid_date = CASE WHEN total_paid >= invoice_total THEN CURRENT_DATE ELSE NULL END,
        updated_at = now()
    WHERE id = OLD.invoice_id;
    
    RETURN OLD;
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM public.invoice_payments
    WHERE invoice_id = NEW.invoice_id;
    
    SELECT total INTO invoice_total FROM public.invoices WHERE id = NEW.invoice_id;
    
    -- Determine new status
    IF total_paid = 0 THEN
      new_status := 'sent';
    ELSIF total_paid >= invoice_total THEN
      new_status := 'paid';
    ELSE
      new_status := 'partially_paid';
    END IF;
    
    UPDATE public.invoices
    SET paid_amount = total_paid,
        remaining_amount = invoice_total - total_paid,
        status = new_status,
        paid_date = CASE WHEN total_paid >= invoice_total THEN CURRENT_DATE ELSE NULL END,
        updated_at = now()
    WHERE id = NEW.invoice_id;
    
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger for invoice payments
DROP TRIGGER IF EXISTS update_invoice_payment_totals_trigger ON public.invoice_payments;
CREATE TRIGGER update_invoice_payment_totals_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_invoice_payment_totals();