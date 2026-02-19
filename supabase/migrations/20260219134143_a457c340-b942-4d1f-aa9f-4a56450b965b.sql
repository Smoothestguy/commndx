
-- ============================================================
-- Step 2: RBAC & RLS Hardening Migration
-- ============================================================

-- 1. Helper: is_assigned_to_project
CREATE OR REPLACE FUNCTION public.is_assigned_to_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_assignments
    WHERE user_id = _user_id AND project_id = _project_id AND status = 'active'
  )
$$;

-- ============================================================
-- CHANGE ORDERS (has project_id)
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can manage change orders" ON public.change_orders;
DROP POLICY IF EXISTS "Staff can view change orders" ON public.change_orders;

CREATE POLICY "Admins and managers full access to change orders"
  ON public.change_orders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Accounting full access to change orders"
  ON public.change_orders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'accounting'))
  WITH CHECK (has_role(auth.uid(), 'accounting'));

CREATE POLICY "Users view assigned project change orders"
  ON public.change_orders FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'user')
    AND has_permission(auth.uid(), 'change_orders', 'view')
    AND is_assigned_to_project(auth.uid(), project_id)
  );

-- ============================================================
-- ESTIMATES (has project_id)
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can manage estimates" ON public.estimates;
DROP POLICY IF EXISTS "Staff can view estimates" ON public.estimates;

CREATE POLICY "Admins and managers full access to estimates"
  ON public.estimates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Accounting full access to estimates"
  ON public.estimates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'accounting'))
  WITH CHECK (has_role(auth.uid(), 'accounting'));

CREATE POLICY "Users view assigned project estimates"
  ON public.estimates FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'user')
    AND has_permission(auth.uid(), 'estimates', 'view')
    AND is_assigned_to_project(auth.uid(), project_id)
  );

-- ============================================================
-- INVOICES (has project_id)
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Staff can view invoices" ON public.invoices;

CREATE POLICY "Admins and managers full access to invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Accounting full access to invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'accounting'))
  WITH CHECK (has_role(auth.uid(), 'accounting'));

CREATE POLICY "Users view assigned project invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'user')
    AND has_permission(auth.uid(), 'invoices', 'view')
    AND is_assigned_to_project(auth.uid(), project_id)
  );

-- ============================================================
-- PURCHASE ORDERS (has project_id)
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can manage purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Staff can view all purchase orders" ON public.purchase_orders;

CREATE POLICY "Admins and managers full access to purchase orders"
  ON public.purchase_orders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Accounting full access to purchase orders"
  ON public.purchase_orders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'accounting'))
  WITH CHECK (has_role(auth.uid(), 'accounting'));

CREATE POLICY "Users view assigned project purchase orders"
  ON public.purchase_orders FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'user')
    AND has_permission(auth.uid(), 'purchase_orders', 'view')
    AND is_assigned_to_project(auth.uid(), project_id)
  );

-- ============================================================
-- JOB ORDERS (has project_id)
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can manage job orders" ON public.job_orders;
DROP POLICY IF EXISTS "Staff can view job orders" ON public.job_orders;

CREATE POLICY "Admins and managers full access to job orders"
  ON public.job_orders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Accounting full access to job orders"
  ON public.job_orders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'accounting'))
  WITH CHECK (has_role(auth.uid(), 'accounting'));

CREATE POLICY "Users view assigned project job orders"
  ON public.job_orders FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'user')
    AND has_permission(auth.uid(), 'job_orders', 'view')
    AND is_assigned_to_project(auth.uid(), project_id)
  );

-- ============================================================
-- VENDOR BILLS (no project_id - scope via purchase_orders)
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can manage vendor bills" ON public.vendor_bills;
DROP POLICY IF EXISTS "Staff can view vendor bills" ON public.vendor_bills;
DROP POLICY IF EXISTS "Admins and managers can view all vendor bills" ON public.vendor_bills;

CREATE POLICY "Admins and managers full access to vendor bills"
  ON public.vendor_bills FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Accounting full access to vendor bills"
  ON public.vendor_bills FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'accounting'))
  WITH CHECK (has_role(auth.uid(), 'accounting'));

CREATE POLICY "Users view assigned project vendor bills"
  ON public.vendor_bills FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'user')
    AND has_permission(auth.uid(), 'vendor_bills', 'view')
    AND (
      purchase_order_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id = vendor_bills.purchase_order_id
          AND is_assigned_to_project(auth.uid(), po.project_id)
      )
    )
  );

-- ============================================================
-- PO ADDENDUMS (no project_id - scope via purchase_orders)
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can manage po_addendums" ON public.po_addendums;
DROP POLICY IF EXISTS "Authenticated users can view po_addendums" ON public.po_addendums;

CREATE POLICY "Admins and managers full access to po addendums"
  ON public.po_addendums FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Accounting full access to po addendums"
  ON public.po_addendums FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'accounting'))
  WITH CHECK (has_role(auth.uid(), 'accounting'));

CREATE POLICY "Users view assigned project po addendums"
  ON public.po_addendums FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'user')
    AND EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = po_addendums.purchase_order_id
        AND is_assigned_to_project(auth.uid(), po.project_id)
    )
  );

-- ============================================================
-- PROJECT ASSIGNMENTS
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can manage assignments" ON public.project_assignments;
DROP POLICY IF EXISTS "Admins and managers can view all assignments" ON public.project_assignments;
DROP POLICY IF EXISTS "Staff can view project assignments" ON public.project_assignments;

CREATE POLICY "Admins and managers full access to assignments"
  ON public.project_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- "Users can view their own assignments" already exists, keep it

-- ============================================================
-- PROJECTS
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can manage projects" ON public.projects;
DROP POLICY IF EXISTS "Staff can view all projects" ON public.projects;

CREATE POLICY "Admins and managers full access to projects"
  ON public.projects FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Users view assigned projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'user')
    AND is_assigned_to_project(auth.uid(), id)
  );

-- ============================================================
-- Performance index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_project_assignments_user_project_status
  ON public.project_assignments (user_id, project_id, status);
