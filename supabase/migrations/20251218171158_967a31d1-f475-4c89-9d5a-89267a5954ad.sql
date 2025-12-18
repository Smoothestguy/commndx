-- Add vendor_bill_id to project_labor_expenses to link vendor bills to project expenses
ALTER TABLE public.project_labor_expenses 
  ADD COLUMN IF NOT EXISTS vendor_bill_id UUID REFERENCES public.vendor_bills(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_labor_expenses_vendor_bill_id 
  ON public.project_labor_expenses(vendor_bill_id);

-- Add comment
COMMENT ON COLUMN public.project_labor_expenses.vendor_bill_id IS 
  'Link to vendor bill created from time entries for this labor expense';