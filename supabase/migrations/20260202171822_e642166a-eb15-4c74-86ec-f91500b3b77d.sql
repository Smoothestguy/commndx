-- ============================================================================
-- COMPREHENSIVE RLS HARDENING MIGRATION (Part 2 - Fix remaining tables)
-- Drops existing policies before creating new ones
-- ============================================================================

-- B2. time_entries (GPS locations, hourly rates) - drop existing first
DROP POLICY IF EXISTS "Personnel can view own time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Admins and managers can view all time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Authenticated users can view time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Anyone can view time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Users can view time entries" ON public.time_entries;

CREATE POLICY "Admins and managers can view all time entries"
  ON public.time_entries FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Personnel can view own time entries"
  ON public.time_entries FOR SELECT
  TO authenticated
  USING (
    personnel_id = public.get_personnel_id_for_user(auth.uid())
  );

-- B3. reimbursements - drop existing first
DROP POLICY IF EXISTS "Personnel can view own reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Admins and managers can view all reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Authenticated users can view reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Anyone can view reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Users can view reimbursements" ON public.reimbursements;

CREATE POLICY "Admins and managers can view all reimbursements"
  ON public.reimbursements FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Personnel can view own reimbursements"
  ON public.reimbursements FOR SELECT
  TO authenticated
  USING (
    personnel_id = public.get_personnel_id_for_user(auth.uid())
  );

-- B4. vendor_bills - drop existing first
DROP POLICY IF EXISTS "Vendors can view own bills" ON public.vendor_bills;
DROP POLICY IF EXISTS "Admins and managers can view all vendor bills" ON public.vendor_bills;
DROP POLICY IF EXISTS "Authenticated users can view vendor bills" ON public.vendor_bills;
DROP POLICY IF EXISTS "Anyone can view vendor_bills" ON public.vendor_bills;
DROP POLICY IF EXISTS "Users can view vendor bills" ON public.vendor_bills;

CREATE POLICY "Admins and managers can view all vendor bills"
  ON public.vendor_bills FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Vendors can view own bills"
  ON public.vendor_bills FOR SELECT
  TO authenticated
  USING (
    vendor_id = public.get_vendor_id_for_user(auth.uid())
  );

-- B5. vendors - drop existing first
DROP POLICY IF EXISTS "Vendors can view own record" ON public.vendors;
DROP POLICY IF EXISTS "Admins and managers can view all vendors" ON public.vendors;
DROP POLICY IF EXISTS "Authenticated users can view vendors" ON public.vendors;
DROP POLICY IF EXISTS "Anyone can view vendors" ON public.vendors;
DROP POLICY IF EXISTS "Users can view vendors" ON public.vendors;

CREATE POLICY "Admins and managers can view all vendors"
  ON public.vendors FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Vendors can view own record"
  ON public.vendors FOR SELECT
  TO authenticated
  USING (
    id = public.get_vendor_id_for_user(auth.uid())
  );

-- ============================================================================
-- SECTION C: STAFF-ONLY TABLES (Admin/Manager/User roles)
-- ============================================================================

-- C1. customers - drop existing first
DROP POLICY IF EXISTS "Staff can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can view customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view customers" ON public.customers;

CREATE POLICY "Staff can view customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

-- C2. invoices - drop existing first
DROP POLICY IF EXISTS "Staff can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Anyone can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can view invoices" ON public.invoices;

CREATE POLICY "Staff can view invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

-- C3. estimates - drop existing first
DROP POLICY IF EXISTS "Staff can view estimates" ON public.estimates;
DROP POLICY IF EXISTS "Authenticated users can view estimates" ON public.estimates;
DROP POLICY IF EXISTS "Anyone can view estimates" ON public.estimates;
DROP POLICY IF EXISTS "Users can view estimates" ON public.estimates;

CREATE POLICY "Staff can view estimates"
  ON public.estimates FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

-- C4. projects - drop existing first
DROP POLICY IF EXISTS "Staff can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Personnel can view assigned projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can view projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects" ON public.projects;

CREATE POLICY "Staff can view all projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

CREATE POLICY "Personnel can view assigned projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnel_project_assignments ppa
      WHERE ppa.project_id = projects.id
      AND ppa.personnel_id = public.get_personnel_id_for_user(auth.uid())
      AND ppa.status = 'active'
    )
  );

-- C5. job_orders - drop existing first
DROP POLICY IF EXISTS "Staff can view job orders" ON public.job_orders;
DROP POLICY IF EXISTS "Authenticated users can view job orders" ON public.job_orders;
DROP POLICY IF EXISTS "Anyone can view job_orders" ON public.job_orders;
DROP POLICY IF EXISTS "Users can view job orders" ON public.job_orders;

CREATE POLICY "Staff can view job orders"
  ON public.job_orders FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

-- C6. purchase_orders - drop existing first
DROP POLICY IF EXISTS "Staff can view all purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Vendors can view own purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Authenticated users can view purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Anyone can view purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can view purchase orders" ON public.purchase_orders;

CREATE POLICY "Staff can view all purchase orders"
  ON public.purchase_orders FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

CREATE POLICY "Vendors can view own purchase orders"
  ON public.purchase_orders FOR SELECT
  TO authenticated
  USING (
    vendor_id = public.get_vendor_id_for_user(auth.uid())
  );

-- C7. change_orders - drop existing first
DROP POLICY IF EXISTS "Staff can view change orders" ON public.change_orders;
DROP POLICY IF EXISTS "Authenticated users can view change orders" ON public.change_orders;
DROP POLICY IF EXISTS "Anyone can view change_orders" ON public.change_orders;
DROP POLICY IF EXISTS "Users can view change orders" ON public.change_orders;

CREATE POLICY "Staff can view change orders"
  ON public.change_orders FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

-- C8. invoice_payments - drop existing first
DROP POLICY IF EXISTS "Staff can view invoice payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Authenticated users can view invoice payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Anyone can view invoice_payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Users can view invoice payments" ON public.invoice_payments;

CREATE POLICY "Staff can view invoice payments"
  ON public.invoice_payments FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

-- C9. applicants - drop existing first
DROP POLICY IF EXISTS "Staff can view applicants" ON public.applicants;
DROP POLICY IF EXISTS "Authenticated users can view applicants" ON public.applicants;
DROP POLICY IF EXISTS "Anyone can view applicants" ON public.applicants;
DROP POLICY IF EXISTS "Users can view applicants" ON public.applicants;

CREATE POLICY "Staff can view applicants"
  ON public.applicants FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

-- C10. applications - drop existing first
DROP POLICY IF EXISTS "Staff can view applications" ON public.applications;
DROP POLICY IF EXISTS "Authenticated users can view applications" ON public.applications;
DROP POLICY IF EXISTS "Anyone can view applications" ON public.applications;
DROP POLICY IF EXISTS "Users can view applications" ON public.applications;

CREATE POLICY "Staff can view applications"
  ON public.applications FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

-- ============================================================================
-- SECTION D: TOKEN-BASED ACCESS TABLES
-- ============================================================================

-- D1. personnel_onboarding_tokens - drop existing first
DROP POLICY IF EXISTS "Staff can view all personnel onboarding tokens" ON public.personnel_onboarding_tokens;
DROP POLICY IF EXISTS "Authenticated users can view personnel onboarding tokens" ON public.personnel_onboarding_tokens;
DROP POLICY IF EXISTS "Anyone can view personnel_onboarding_tokens" ON public.personnel_onboarding_tokens;
DROP POLICY IF EXISTS "Users can view personnel onboarding tokens" ON public.personnel_onboarding_tokens;
DROP POLICY IF EXISTS "Public can lookup onboarding tokens" ON public.personnel_onboarding_tokens;

CREATE POLICY "Staff can view all personnel onboarding tokens"
  ON public.personnel_onboarding_tokens FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- D2. vendor_onboarding_tokens - drop existing first
DROP POLICY IF EXISTS "Staff can view all vendor onboarding tokens" ON public.vendor_onboarding_tokens;
DROP POLICY IF EXISTS "Authenticated users can view vendor onboarding tokens" ON public.vendor_onboarding_tokens;
DROP POLICY IF EXISTS "Anyone can view vendor_onboarding_tokens" ON public.vendor_onboarding_tokens;
DROP POLICY IF EXISTS "Users can view vendor onboarding tokens" ON public.vendor_onboarding_tokens;
DROP POLICY IF EXISTS "Public can lookup vendor onboarding tokens" ON public.vendor_onboarding_tokens;

CREATE POLICY "Staff can view all vendor onboarding tokens"
  ON public.vendor_onboarding_tokens FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- D3. personnel_invitations - drop existing first
DROP POLICY IF EXISTS "Staff can view all personnel invitations" ON public.personnel_invitations;
DROP POLICY IF EXISTS "Authenticated users can view personnel invitations" ON public.personnel_invitations;
DROP POLICY IF EXISTS "Anyone can view personnel_invitations" ON public.personnel_invitations;
DROP POLICY IF EXISTS "Users can view personnel invitations" ON public.personnel_invitations;
DROP POLICY IF EXISTS "Anyone can view invitations by token" ON public.personnel_invitations;

CREATE POLICY "Staff can view all personnel invitations"
  ON public.personnel_invitations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- D4. vendor_invitations - drop existing first
DROP POLICY IF EXISTS "Staff can view all vendor invitations" ON public.vendor_invitations;
DROP POLICY IF EXISTS "Authenticated users can view vendor invitations" ON public.vendor_invitations;
DROP POLICY IF EXISTS "Anyone can view vendor_invitations" ON public.vendor_invitations;
DROP POLICY IF EXISTS "Users can view vendor invitations" ON public.vendor_invitations;

CREATE POLICY "Staff can view all vendor invitations"
  ON public.vendor_invitations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- D5. invitations - drop existing first
DROP POLICY IF EXISTS "Staff can view all invitations" ON public.invitations;
DROP POLICY IF EXISTS "Authenticated users can view invitations" ON public.invitations;
DROP POLICY IF EXISTS "Anyone can view invitations" ON public.invitations;
DROP POLICY IF EXISTS "Users can view invitations" ON public.invitations;

CREATE POLICY "Staff can view all invitations"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );