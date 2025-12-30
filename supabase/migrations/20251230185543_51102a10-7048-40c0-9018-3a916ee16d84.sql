-- Add columns to track when a PO was reopened
ALTER TABLE public.purchase_orders 
  ADD COLUMN IF NOT EXISTS reopened_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reopened_by uuid;