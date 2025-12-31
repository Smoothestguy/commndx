-- Add common construction expense categories (Fuel, Meals, etc.)
INSERT INTO expense_categories (name, description, category_type, is_active)
VALUES 
  ('Fuel', 'Vehicle fuel and gas expenses', 'both', true),
  ('Meals', 'Business meal and per diem expenses', 'both', true),
  ('Tools & Equipment', 'Small tools and equipment purchases', 'both', true),
  ('Safety Supplies', 'PPE and safety equipment', 'both', true),
  ('Parking & Tolls', 'Parking fees and road tolls', 'both', true)
ON CONFLICT DO NOTHING;

-- Create QuickBooks account mappings table
CREATE TABLE IF NOT EXISTS quickbooks_account_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  quickbooks_account_id TEXT NOT NULL,
  quickbooks_account_name TEXT,
  quickbooks_account_type TEXT,
  quickbooks_account_subtype TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(quickbooks_account_id)
);

-- Enable RLS on quickbooks_account_mappings
ALTER TABLE quickbooks_account_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for quickbooks_account_mappings
CREATE POLICY "Admins and managers can manage account mappings"
ON quickbooks_account_mappings
FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view account mappings"
ON quickbooks_account_mappings
FOR SELECT
USING (true);

-- Add category_id foreign key to reimbursements table
ALTER TABLE reimbursements 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES expense_categories(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_reimbursements_category_id ON reimbursements(category_id);

-- Create index on quickbooks_account_mappings
CREATE INDEX IF NOT EXISTS idx_qb_account_mappings_expense_category 
ON quickbooks_account_mappings(expense_category_id);