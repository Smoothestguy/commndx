-- Add quickbooks_payment_id column to vendor_bill_payments table
ALTER TABLE vendor_bill_payments 
ADD COLUMN IF NOT EXISTS quickbooks_payment_id TEXT;