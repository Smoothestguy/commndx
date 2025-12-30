-- Add notes and customer_po columns to invoices table
ALTER TABLE public.invoices
ADD COLUMN notes text,
ADD COLUMN customer_po text;