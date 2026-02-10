
-- Add account, class, location, and memo fields to vendor_bills for bulk editing support
ALTER TABLE public.vendor_bills
  ADD COLUMN IF NOT EXISTS account TEXT,
  ADD COLUMN IF NOT EXISTS class TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS memo TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.vendor_bills.account IS 'GL account assignment for the bill';
COMMENT ON COLUMN public.vendor_bills.class IS 'Class/department tracking for the bill';
COMMENT ON COLUMN public.vendor_bills.location IS 'Location tracking for the bill';
COMMENT ON COLUMN public.vendor_bills.memo IS 'Memo/description for the bill';
