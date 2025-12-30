-- Add tm_ticket_id to invoices table to track which T&M ticket an invoice is for
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS tm_ticket_id uuid REFERENCES public.tm_tickets(id);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_invoices_tm_ticket_id ON public.invoices(tm_ticket_id);

-- Add 'invoiced' status to tm_ticket_status enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'invoiced' AND enumtypid = 'tm_ticket_status'::regtype) THEN
    ALTER TYPE tm_ticket_status ADD VALUE 'invoiced';
  END IF;
END $$;