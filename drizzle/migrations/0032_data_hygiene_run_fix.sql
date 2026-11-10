CREATE OR REPLACE FUNCTION public.data_hygiene_run()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE na int; np int; em text;
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
  SELECT email INTO em FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.audit_logs (action_type, resource_type, user_id, user_email, success, changes_after)
  VALUES ('update', 'data_hygiene', auth.uid(), coalesce(em, 'system (scheduled)'), true,
          jsonb_build_object('archived_applicants', na, 'deactivated_personnel', np));
  RETURN jsonb_build_object('archived_applicants', na, 'deactivated_personnel', np);
END $$;
REVOKE ALL ON FUNCTION public.data_hygiene_run() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.data_hygiene_run() TO authenticated, service_role;