-- Add 'vendor' to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'vendor';

-- Add user_id to vendors table for portal access
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);

-- Add submitted_at to vendor_bills for tracking when vendor submitted
ALTER TABLE vendor_bills ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone;
ALTER TABLE vendor_bills ADD COLUMN IF NOT EXISTS submitted_by_vendor boolean DEFAULT false;

-- Create vendor_invitations table (similar to personnel_invitations)
CREATE TABLE IF NOT EXISTS vendor_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid REFERENCES auth.users(id) NOT NULL,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on vendor_invitations
ALTER TABLE vendor_invitations ENABLE ROW LEVEL SECURITY;

-- RLS policies for vendor_invitations
CREATE POLICY "Admins and managers can manage vendor invitations"
ON vendor_invitations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Anyone can view vendor invitations by token"
ON vendor_invitations
FOR SELECT
USING (true);

-- Create helper function to check if user is a vendor
CREATE OR REPLACE FUNCTION public.is_vendor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendors WHERE user_id = _user_id
  )
$$;

-- Create helper function to get vendor_id for user
CREATE OR REPLACE FUNCTION public.get_vendor_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.vendors WHERE user_id = _user_id LIMIT 1
$$;

-- Add RLS policy for vendors to view own record
CREATE POLICY "Vendors can view own record"
ON vendors
FOR SELECT
USING (user_id = auth.uid());

-- Add RLS policy for vendors to view their own purchase orders
CREATE POLICY "Vendors can view their own purchase orders"
ON purchase_orders
FOR SELECT
USING (vendor_id = get_vendor_id_for_user(auth.uid()));

-- Add RLS policy for vendors to view PO line items for their POs
CREATE POLICY "Vendors can view their PO line items"
ON po_line_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = po_line_items.purchase_order_id
    AND po.vendor_id = get_vendor_id_for_user(auth.uid())
  )
);

-- Add RLS policy for vendors to view their own vendor bills
CREATE POLICY "Vendors can view their own bills"
ON vendor_bills
FOR SELECT
USING (vendor_id = get_vendor_id_for_user(auth.uid()));

-- Add RLS policy for vendors to create their own bills
CREATE POLICY "Vendors can create their own bills"
ON vendor_bills
FOR INSERT
WITH CHECK (vendor_id = get_vendor_id_for_user(auth.uid()));

-- Add RLS policy for vendors to update their own bills (only if not approved)
CREATE POLICY "Vendors can update their own draft bills"
ON vendor_bills
FOR UPDATE
USING (
  vendor_id = get_vendor_id_for_user(auth.uid())
  AND status IN ('draft', 'open')
);

-- Add RLS policy for vendors to view line items for their bills
CREATE POLICY "Vendors can view their bill line items"
ON vendor_bill_line_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM vendor_bills vb
    WHERE vb.id = vendor_bill_line_items.bill_id
    AND vb.vendor_id = get_vendor_id_for_user(auth.uid())
  )
);

-- Add RLS policy for vendors to manage line items for their draft bills
CREATE POLICY "Vendors can manage their draft bill line items"
ON vendor_bill_line_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM vendor_bills vb
    WHERE vb.id = vendor_bill_line_items.bill_id
    AND vb.vendor_id = get_vendor_id_for_user(auth.uid())
    AND vb.status IN ('draft', 'open')
  )
);

-- Add RLS policy for vendors to view PO addendums for their POs
CREATE POLICY "Vendors can view their PO addendums"
ON po_addendums
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = po_addendums.purchase_order_id
    AND po.vendor_id = get_vendor_id_for_user(auth.uid())
  )
);

-- Add RLS policy for vendors to view projects related to their POs
CREATE POLICY "Vendors can view projects from their POs"
ON projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.project_id = projects.id
    AND po.vendor_id = get_vendor_id_for_user(auth.uid())
  )
);