-- Add is_taxable column to job_order_line_items table
ALTER TABLE public.job_order_line_items 
ADD COLUMN is_taxable boolean DEFAULT true;

-- Update existing records to have is_taxable = true (safe default)
UPDATE public.job_order_line_items SET is_taxable = true WHERE is_taxable IS NULL;