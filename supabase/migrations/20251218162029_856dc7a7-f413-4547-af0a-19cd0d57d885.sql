-- Add vendor_bill_id to time_entries to track which entries are billed
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS vendor_bill_id UUID REFERENCES vendor_bills(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_time_entries_vendor_bill_id ON time_entries(vendor_bill_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_invoice_id ON time_entries(invoice_id);