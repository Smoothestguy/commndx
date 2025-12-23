-- Add product_id column to invoice_line_items for QuickBooks ItemRef lookup
ALTER TABLE public.invoice_line_items 
ADD COLUMN product_id UUID REFERENCES public.products(id);