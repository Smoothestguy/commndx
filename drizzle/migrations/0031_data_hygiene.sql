ALTER TYPE public.applicant_status ADD VALUE IF NOT EXISTS 'archived';

CREATE INDEX IF NOT EXISTS idx_visit_personnel_person_checkin ON public.visit_personnel (personnel_id, checked_in_at);
CREATE INDEX IF NOT EXISTS idx_visit_personnel_visit_checkin ON public.visit_personnel (visit_id, checked_in_at);
CREATE INDEX IF NOT EXISTS idx_location_assignments_location_status ON public.location_assignments (location_id, status);
CREATE INDEX IF NOT EXISTS idx_time_entries_location_date ON public.time_entries (location_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_project_date ON public.time_entries (project_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_alert_log_date ON public.alert_log (alert_date);
CREATE INDEX IF NOT EXISTS idx_applicants_status_created ON public.applicants (status, created_at);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON public.applications (applicant_id);
CREATE INDEX IF NOT EXISTS idx_personnel_applicant ON public.personnel (applicant_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON public.admin_notifications (created_at DESC);

-- Candidates: applicants idle 90+ days, never linked to personnel.
CREATE OR REPLACE FUNCTION public._hygiene_applicant_candidates()
RETURNS SETOF uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT a.id FROM public.applicants a
  WHERE a.status::text IN ('new','rejected','inactive')
    AND greatest(a.created_at, coalesce(a.updated_at, a.created_at)) < now() - interval '90 days'
    AND NOT EXISTS (SELECT 1 FROM public.personnel p WHERE p.applicant_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM public.applications ap WHERE ap.applicant_id = a.id
                    AND greatest(ap.created_at, coalesce(ap.updated_at, ap.created_at)) >= now() - interval '90 days')
    AND NOT EXISTS (SELECT 1 FROM public.applicant_messages m WHERE m.applicant_id = a.id
                    AND m.created_at >= now() - interval '90 days');
END $$;

-- Candidates: active personnel with no assignment, stay or time entry in 120 days.
CREATE OR REPLACE FUNCTION public._hygiene_personnel_candidates()
RETURNS SETOF uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT p.id FROM public.personnel p
  WHERE p.status = 'active'
    AND p.created_at < now() - interval '120 days'
    AND NOT EXISTS (SELECT 1 FROM public.location_assignments la WHERE la.personnel_id = p.id
                    AND (la.status = 'active' OR coalesce(la.unassigned_at, la.assigned_at) >= now() - interval '120 days'))
    AND NOT EXISTS (SELECT 1 FROM public.personnel_project_assignments pa WHERE pa.personnel_id = p.id
                    AND (pa.status = 'active' OR coalesce(pa.unassigned_at, pa.assigned_at) >= now() - interval '120 days'))
    AND NOT EXISTS (SELECT 1 FROM public.visit_personnel vp WHERE vp.personnel_id = p.id
                    AND vp.checked_in_at >= now() - interval '120 days')
    AND NOT EXISTS (SELECT 1 FROM public.time_entries t WHERE t.personnel_id = p.id
                    AND t.entry_date >= (now() - interval '120 days')::date);
END $$;
REVOKE ALL ON FUNCTION public._hygiene_applicant_candidates() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._hygiene_personnel_candidates() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.data_hygiene_preview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN jsonb_build_object(
    'archive_applicants', (SELECT count(*) FROM public._hygiene_applicant_candidates()),
    'deactivate_personnel', (SELECT count(*) FROM public._hygiene_personnel_candidates()),
    'archived_applicants', (SELECT count(*) FROM public.applicants WHERE status::text = 'archived'),
    'inactive_personnel', (SELECT count(*) FROM public.personnel WHERE status = 'inactive'));
END $$;

CREATE OR REPLACE FUNCTION public.data_hygiene_run()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE na int; np int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.applicants SET status = 'archived'::public.applicant_status
   WHERE id IN (SELECT public._hygiene_applicant_candidates());
  GET DIAGNOSTICS na = ROW_COUNT;
  UPDATE public.personnel SET status = 'inactive'
   WHERE id IN (SELECT public._hygiene_personnel_candidates());
  GET DIAGNOSTICS np = ROW_COUNT;
  INSERT INTO public.audit_logs (action_type, resource_type, user_id, changes_after)
  VALUES ('update', 'data_hygiene', auth.uid(), jsonb_build_object('archived_applicants', na, 'deactivated_personnel', np));
  RETURN jsonb_build_object('archived_applicants', na, 'deactivated_personnel', np);
EXCEPTION WHEN undefined_column OR not_null_violation THEN
  RETURN jsonb_build_object('archived_applicants', na, 'deactivated_personnel', np);
END $$;
REVOKE ALL ON FUNCTION public.data_hygiene_preview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.data_hygiene_run() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.data_hygiene_preview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.data_hygiene_run() TO authenticated, service_role;