
DROP POLICY IF EXISTS "Anon can check applicant by email" ON public.applicants;
DROP POLICY IF EXISTS "Anon can check applications" ON public.applications;

DROP POLICY IF EXISTS "Users can view estimate versions" ON public.estimate_versions;
DROP POLICY IF EXISTS "Users can create estimate versions" ON public.estimate_versions;
CREATE POLICY "Staff can view estimate versions"
  ON public.estimate_versions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Staff can create estimate versions"
  ON public.estimate_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'user'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view insurance claims" ON public.insurance_claims;
CREATE POLICY "Admins and managers can view insurance claims"
  ON public.insurance_claims FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

DROP POLICY IF EXISTS "Public can view invitation by token" ON public.invitations;

DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.messages;
CREATE POLICY "Admins managers or sender can view messages"
  ON public.messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) OR sent_by = auth.uid());

DROP POLICY IF EXISTS "Anonymous can validate token by value" ON public.personnel_onboarding_tokens;
DROP POLICY IF EXISTS "Service role can update tokens" ON public.personnel_onboarding_tokens;
DROP POLICY IF EXISTS "Service role can insert tokens" ON public.personnel_onboarding_tokens;
CREATE POLICY "Service role can insert tokens"
  ON public.personnel_onboarding_tokens FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update tokens"
  ON public.personnel_onboarding_tokens FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view personnel payments" ON public.personnel_payments;
CREATE POLICY "Admins managers or self can view personnel payments"
  ON public.personnel_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) OR personnel_id = public.get_personnel_id_for_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view personnel assignments" ON public.personnel_project_assignments;
CREATE POLICY "Admins and managers can view personnel assignments"
  ON public.personnel_project_assignments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

DROP POLICY IF EXISTS "Anyone can complete invites" ON public.personnel_registration_invites;
DROP POLICY IF EXISTS "Anyone can view invites by token" ON public.personnel_registration_invites;

DROP POLICY IF EXISTS "Authenticated users can view labor expenses" ON public.project_labor_expenses;
CREATE POLICY "Admins and managers can view labor expenses"
  ON public.project_labor_expenses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view rate brackets" ON public.project_rate_brackets;
CREATE POLICY "Admins and managers can view rate brackets"
  ON public.project_rate_brackets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view vendor bill line items" ON public.vendor_bill_line_items;

DROP POLICY IF EXISTS "Authenticated users can view vendor bill payments" ON public.vendor_bill_payments;
CREATE POLICY "Admins and managers can view vendor bill payments"
  ON public.vendor_bill_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Vendors can view payments on their bills"
  ON public.vendor_bill_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendor_bills vb WHERE vb.id = vendor_bill_payments.bill_id AND vb.vendor_id = public.get_vendor_id_for_user(auth.uid())));

DROP POLICY IF EXISTS "Anyone can view vendor invitations by token" ON public.vendor_invitations;
DROP POLICY IF EXISTS "Allow public read for onboarding validation" ON public.vendor_onboarding_tokens;

ALTER FUNCTION public.increment_unread_count(uuid, text, uuid) SET search_path = public;
ALTER FUNCTION public.generate_personnel_number() SET search_path = public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='cleanup_stale_typing') THEN
    EXECUTE 'ALTER FUNCTION public.cleanup_stale_typing() SET search_path = public';
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.find_duplicate_personnel(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_duplicate_customers(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_duplicate_vendors(uuid) FROM anon, authenticated;
