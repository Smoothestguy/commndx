-- Fix RLS policies to restrict personnel from viewing customers, vendors, and vendor_bills
-- Personnel should only have access to their own portal data, not company-wide data

-- Drop overly-permissive SELECT policies for customers
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;

-- Drop overly-permissive SELECT policies for vendors
DROP POLICY IF EXISTS "Authenticated users can view vendors" ON vendors;

-- Drop overly-permissive SELECT policies for vendor_bills
DROP POLICY IF EXISTS "Authenticated users can view vendor bills" ON vendor_bills;

-- Create proper role-based SELECT policies for customers
-- Only admins, managers, and regular users (not personnel-only) can view customers
CREATE POLICY "Staff can view customers" ON customers
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'user'::app_role)
);

-- Create proper role-based SELECT policies for vendors
-- Only admins, managers, and regular users can view vendors
CREATE POLICY "Staff can view vendors" ON vendors
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'user'::app_role)
);

-- Create proper role-based SELECT policies for vendor_bills
-- Staff can view all vendor bills, vendors can still see their own via existing policy
CREATE POLICY "Staff can view vendor bills" ON vendor_bills
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'user'::app_role)
);

-- Add storage policy for personnel to upload reimbursement receipts
-- Personnel can upload their own receipts to the document-attachments bucket
CREATE POLICY "Personnel can upload reimbursement receipts" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'document-attachments' AND
  (storage.foldername(name))[1] = 'reimbursement-receipts' AND
  auth.role() = 'authenticated'
);

-- Personnel can view receipts in the reimbursement-receipts folder
CREATE POLICY "Users can view reimbursement receipts" ON storage.objects
FOR SELECT USING (
  bucket_id = 'document-attachments' AND
  (storage.foldername(name))[1] = 'reimbursement-receipts' AND
  auth.role() = 'authenticated'
);