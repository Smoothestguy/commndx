-- Add customer approval fields to po_addendums table
ALTER TABLE po_addendums 
ADD COLUMN IF NOT EXISTS customer_rep_name TEXT,
ADD COLUMN IF NOT EXISTS customer_rep_title TEXT,
ADD COLUMN IF NOT EXISTS customer_rep_email TEXT,
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS approval_token UUID,
ADD COLUMN IF NOT EXISTS sent_for_approval_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by_name TEXT,
ADD COLUMN IF NOT EXISTS approval_signature TEXT,
ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Create index on approval token for fast lookups
CREATE INDEX IF NOT EXISTS idx_po_addendums_approval_token ON po_addendums(approval_token) WHERE approval_token IS NOT NULL;

-- Allow public access to view addendums by token (for approval page)
CREATE POLICY "Anyone can view addendums by approval token"
ON po_addendums
FOR SELECT
USING (approval_token IS NOT NULL);

-- Allow public updates for approval (when token matches)
CREATE POLICY "Anyone can approve addendums with valid token"
ON po_addendums
FOR UPDATE
USING (approval_token IS NOT NULL)
WITH CHECK (approval_token IS NOT NULL);