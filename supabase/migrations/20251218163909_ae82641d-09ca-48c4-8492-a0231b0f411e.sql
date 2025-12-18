-- Add separate pay_rate and bill_rate columns to personnel table
ALTER TABLE personnel 
  ADD COLUMN IF NOT EXISTS pay_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bill_rate NUMERIC DEFAULT 0;

-- Migrate existing hourly_rate data to pay_rate
UPDATE personnel SET pay_rate = COALESCE(hourly_rate, 0) WHERE pay_rate = 0 OR pay_rate IS NULL;

-- Set initial bill_rate as 2x pay_rate (users should adjust these)
UPDATE personnel SET bill_rate = COALESCE(hourly_rate * 2, 0) WHERE bill_rate = 0 OR bill_rate IS NULL;

-- Add comment to clarify field usage
COMMENT ON COLUMN personnel.pay_rate IS 'Internal payroll rate - used for vendor bills and payroll';
COMMENT ON COLUMN personnel.bill_rate IS 'Customer-facing billing rate - used for customer invoices';
COMMENT ON COLUMN personnel.hourly_rate IS 'DEPRECATED: Use pay_rate for internal costs, bill_rate for customer billing';