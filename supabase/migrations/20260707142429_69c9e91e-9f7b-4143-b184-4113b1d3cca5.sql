
-- =========================================================================
-- SECURITY HARDENING MIGRATION
-- =========================================================================

-- ----- 1. Tighten SELECT on financial payment attachments -----
DROP POLICY IF EXISTS "Authenticated users can view invoice payment attachments" ON public.invoice_payment_attachments;
CREATE POLICY "Staff can view invoice payment attachments"
  ON public.invoice_payment_attachments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting')
  );

DROP POLICY IF EXISTS "Authenticated users can view vendor bill payment attachments" ON public.vendor_bill_payment_attachments;
CREATE POLICY "Staff can view vendor bill payment attachments"
  ON public.vendor_bill_payment_attachments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting')
  );

-- ----- 2. Vendor documents: staff or owning vendor only -----
DROP POLICY IF EXISTS "Authenticated users can view vendor documents" ON public.vendor_documents;
CREATE POLICY "Staff or owning vendor can view vendor documents"
  ON public.vendor_documents FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting')
    OR EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_documents.vendor_id AND v.user_id = auth.uid()
    )
  );

-- ----- 3. Vendor onboarding documents: staff or owning vendor only -----
DROP POLICY IF EXISTS "Authenticated users can view vendor documents" ON public.vendor_onboarding_documents;
-- (Vendors can view their own documents policy already exists — keep it)
CREATE POLICY "Staff can view vendor onboarding documents"
  ON public.vendor_onboarding_documents FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting')
  );

-- ----- 4. Restrict broadly readable operational tables to staff (not personnel/vendor portal roles) -----
-- Helper predicate: authenticated caller that is not a portal-only user
-- We restrict to admin/manager/accounting/user role holders; personnel/vendor role holders are excluded.

-- activities
DROP POLICY IF EXISTS "Authenticated users can view activities" ON public.activities;
CREATE POLICY "Staff can view activities" ON public.activities FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- appointments
DROP POLICY IF EXISTS "Authenticated users can view appointments" ON public.appointments;
CREATE POLICY "Staff can view appointments" ON public.appointments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- badge_templates
DROP POLICY IF EXISTS "Authenticated users can view badge templates" ON public.badge_templates;
CREATE POLICY "Staff can view badge templates" ON public.badge_templates FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- change_order_line_items
DROP POLICY IF EXISTS "Authenticated users can view change order line items" ON public.change_order_line_items;
CREATE POLICY "Staff can view change order line items" ON public.change_order_line_items FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- estimate_attachments
DROP POLICY IF EXISTS "Authenticated users can view estimate attachments" ON public.estimate_attachments;
CREATE POLICY "Staff can view estimate attachments" ON public.estimate_attachments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- estimate_line_items
DROP POLICY IF EXISTS "Authenticated users can view estimate line items" ON public.estimate_line_items;
CREATE POLICY "Staff can view estimate line items" ON public.estimate_line_items FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- invoice_line_items
DROP POLICY IF EXISTS "Authenticated users can view invoice line items" ON public.invoice_line_items;
CREATE POLICY "Staff can view invoice line items" ON public.invoice_line_items FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- job_order_line_items
DROP POLICY IF EXISTS "Authenticated users can view job order line items" ON public.job_order_line_items;
CREATE POLICY "Staff can view job order line items" ON public.job_order_line_items FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- milestones
DROP POLICY IF EXISTS "Authenticated users can view milestones" ON public.milestones;
CREATE POLICY "Staff can view milestones" ON public.milestones FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- po_line_items (keep vendor scoped policy already present)
DROP POLICY IF EXISTS "Authenticated users can view po line items" ON public.po_line_items;
CREATE POLICY "Staff can view po line items" ON public.po_line_items FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- products
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
CREATE POLICY "Staff can view products" ON public.products FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- roof_inspections
DROP POLICY IF EXISTS "Authenticated users can view roof inspections" ON public.roof_inspections;
CREATE POLICY "Staff can view roof inspections" ON public.roof_inspections FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- roof_measurements
DROP POLICY IF EXISTS "Authenticated users can view roof measurements" ON public.roof_measurements;
CREATE POLICY "Staff can view roof measurements" ON public.roof_measurements FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- tasks (keep the assigned-to-self policy)
DROP POLICY IF EXISTS "Authenticated users can view all tasks" ON public.tasks;
CREATE POLICY "Staff can view all tasks" ON public.tasks FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- tm_ticket_line_items
DROP POLICY IF EXISTS "Authenticated users can view tm ticket line items" ON public.tm_ticket_line_items;
CREATE POLICY "Staff can view tm ticket line items" ON public.tm_ticket_line_items FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- tm_tickets
DROP POLICY IF EXISTS "Authenticated users can view tm tickets" ON public.tm_tickets;
CREATE POLICY "Staff can view tm tickets" ON public.tm_tickets FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- weather_logs
DROP POLICY IF EXISTS "Authenticated users can view weather logs" ON public.weather_logs;
CREATE POLICY "Staff can view weather logs" ON public.weather_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- weekly_labor_invoices
DROP POLICY IF EXISTS "Authenticated users can view weekly labor invoices" ON public.weekly_labor_invoices;
CREATE POLICY "Staff can view weekly labor invoices" ON public.weekly_labor_invoices FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'user')
  );

-- ----- 5. Column-level restriction for anonymous onboarding SELECT on personnel -----
-- Anonymous flow only needs non-sensitive display fields. Sensitive PII columns are revoked.
REVOKE SELECT ON public.personnel FROM anon;
GRANT SELECT (
  id, first_name, last_name, email, phone, date_of_birth, address, city, state, zip,
  photo_url, applicant_id, onboarding_status, onboarding_completed_at
) ON public.personnel TO anon;

-- ----- 6. Restrict personnel_onboarding_tokens anon SELECT to only the necessary columns -----
REVOKE SELECT ON public.personnel_onboarding_tokens FROM anon;
GRANT SELECT (
  id, personnel_id, token, expires_at, used_at, revoked_at, created_at
) ON public.personnel_onboarding_tokens TO anon;

-- ----- 7. Drop broad SELECT storage.objects policies on public buckets (prevents listing; direct public URL still works) -----
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read form files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view dashboard backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read application files" ON storage.objects;
DROP POLICY IF EXISTS "Personnel photos are publicly accessible" ON storage.objects;

-- ----- 8. Tighten always-true INSERT policies on internal tables to service_role only -----
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.admin_notifications;
CREATE POLICY "Service role can insert notifications" ON public.admin_notifications
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert geocode logs" ON public.geocode_logs;
CREATE POLICY "Service role can insert geocode logs" ON public.geocode_logs
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert documents" ON public.personnel_documents;
CREATE POLICY "Service role can insert documents" ON public.personnel_documents
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert sync logs" ON public.quickbooks_sync_log;
CREATE POLICY "Service role can insert sync logs" ON public.quickbooks_sync_log
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can insert locked period violations" ON public.locked_period_violations;
CREATE POLICY "Admins can insert locked period violations" ON public.locked_period_violations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- ----- 9. Revoke EXECUTE from anon on SECURITY DEFINER functions that don't need anonymous access -----
-- Anonymous flows that MUST retain access:
--   complete_personnel_onboarding, complete_vendor_onboarding, confirm_quick_apply,
--   get_quick_apply_invite, save_application_attempt, create_applicant_return_id,
--   create_application_return_id, find_applicant_id_by_email, has_active_application_for_posting,
--   update_applicant_geo
-- Everything else revoke from anon.

DO $$
DECLARE
  fn RECORD;
  keep_anon TEXT[] := ARRAY[
    'complete_personnel_onboarding','complete_vendor_onboarding','confirm_quick_apply',
    'get_quick_apply_invite','save_application_attempt','create_applicant_return_id',
    'create_application_return_id','find_applicant_id_by_email','has_active_application_for_posting',
    'update_applicant_geo'
  ];
  -- Trigger/internal functions that shouldn't be callable by authenticated users either.
  revoke_auth TEXT[] := ARRAY[
    'update_updated_at_column','update_conversation_last_message','update_invoice_payment_totals',
    'update_jo_billing_on_vendor_bill_change','update_jo_invoicing_on_invoice_line_item_change',
    'update_personnel_assignment_activity','update_po_addendum_billing_on_bill_line_item_change',
    'update_po_addendum_totals','update_po_billing_on_bill_line_item_change',
    'update_project_assignment_activity','update_project_total_cost',
    'update_room_scope_billed_quantity','update_vendor_bill_payment_totals',
    'validate_completion_bill_item','validate_room_scope_allocation','validate_vendor_bill_status',
    'set_change_order_number','set_estimate_number','set_invoice_number','set_job_order_number',
    'set_personnel_number','set_personnel_payment_number','set_purchase_order_number',
    'set_tm_ticket_number','set_vendor_bill_number','handle_new_user',
    'reset_vendor_bill_sequence_for_new_year','cleanup_stale_typing','expire_old_invitations',
    'generate_change_order_number','generate_estimate_number','generate_invoice_number',
    'generate_job_order_number','generate_personnel_payment_number','generate_po_addendum_number',
    'generate_purchase_order_number','generate_quick_apply_invites','generate_tm_ticket_number',
    'generate_vendor_bill_number'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    -- Revoke anon unless whitelisted
    IF NOT (fn.proname = ANY(keep_anon)) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', fn.proname, fn.args);
    END IF;
    -- Also revoke authenticated on trigger/internal functions
    IF fn.proname = ANY(revoke_auth) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated', fn.proname, fn.args);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', fn.proname, fn.args);
    END IF;
  END LOOP;
END $$;
