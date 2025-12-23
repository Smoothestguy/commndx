-- Add display_order to invoice_line_items to preserve line item order
ALTER TABLE public.invoice_line_items ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Add product_id to job_order_line_items for QuickBooks product lookup
ALTER TABLE public.job_order_line_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);