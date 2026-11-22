-- Customer Ops: customer-scoped, dollar-free access. Customer ops users get NO direct table/view/storage access;
-- everything flows through the allow-listed SECURITY DEFINER functions below.
CREATE TABLE public.customer_user_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (email, customer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_user_links TO authenticated;
GRANT ALL ON public.customer_user_links TO service_role;
ALTER TABLE public.customer_user_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage customer user links" ON public.customer_user_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_customer_ops(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND public.has_role(_uid, 'customer_ops')
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','manager'))
$$;
REVOKE ALL ON FUNCTION public.is_customer_ops(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_customer_ops(uuid) TO authenticated, service_role;

-- Customers this signed-in customer-ops user may see (matched on the verified auth email, never metadata).
CREATE OR REPLACE FUNCTION public.customer_ops_customer_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.customer_id FROM public.customer_user_links l JOIN auth.users u ON lower(u.email) = lower(l.email)
  WHERE u.id = auth.uid() AND l.revoked_at IS NULL AND public.is_customer_ops(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.customer_ops_customer_ids() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.customer_ops_location_ok(_location uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_locations pl WHERE pl.id = _location
    AND pl.customer_id IN (SELECT public.customer_ops_customer_ids()))
$$;
REVOKE ALL ON FUNCTION public.customer_ops_location_ok(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_ops_location_ok(uuid) TO authenticated, service_role;

-- Block every direct read/write by customer-ops users (restrictive policy ANDs with all existing policies).
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT c.relname FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
           AND c.relrowsecurity AND c.relname <> 'user_roles' LOOP
    EXECUTE format('CREATE POLICY customer_ops_no_direct_access ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT (SELECT public.is_customer_ops(auth.uid()))) WITH CHECK (NOT (SELECT public.is_customer_ops(auth.uid())))', t.relname);
  END LOOP;
END $$;
CREATE POLICY customer_ops_no_direct_access ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT public.is_customer_ops(auth.uid()))) WITH CHECK (NOT (SELECT public.is_customer_ops(auth.uid())));

-- Definer views bypass RLS: hide them from customer-ops users (same columns, staff results unchanged).
CREATE OR REPLACE VIEW public.personnel_directory AS
 SELECT id, first_name, last_name, photo_url, status FROM personnel
  WHERE deleted_at IS NULL AND merged_into_id IS NULL AND NOT public.is_customer_ops(auth.uid());
CREATE OR REPLACE VIEW public.personnel_current_status AS
 SELECT DISTINCT ON (l.personnel_id) l.personnel_id, pd.first_name, pd.last_name, l.status, l.project_id,
    p.name AS project_name, l.effective_at, l.note, l.set_by
   FROM personnel_status_log l LEFT JOIN personnel_directory pd ON pd.id = l.personnel_id LEFT JOIN projects p ON p.id = l.project_id
  WHERE NOT public.is_customer_ops(auth.uid())
  ORDER BY l.personnel_id, l.effective_at DESC;
CREATE OR REPLACE VIEW public.public_task_order_positions AS
 SELECT id, task_order_id, position_label, headcount,
   CASE WHEN show_pay_publicly THEN advertised_pay_rate ELSE NULL::numeric END AS advertised_pay_rate
  FROM task_order_positions top
  WHERE task_order_id IN (SELECT jp.task_order_id FROM job_postings jp WHERE jp.is_open = true)
    AND NOT public.is_customer_ops(auth.uid());

-- ===== Allow-listed, dollar-free reads =====
CREATE OR REPLACE FUNCTION public.customer_ops_locations()
RETURNS TABLE(location_id uuid, location_name text, project_id uuid, project_name text, city text, state text, status text, timezone text, active_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pl.id, pl.name, p.id, p.name, pl.city, pl.state, pl.status, pl.timezone,
    (SELECT count(*) FROM location_assignments a WHERE a.location_id = pl.id AND a.status = 'active')
  FROM project_locations pl JOIN projects p ON p.id = pl.project_id
  WHERE pl.customer_id IN (SELECT public.customer_ops_customer_ids()) AND p.deleted_at IS NULL
  ORDER BY (pl.status = 'closed'), p.name, pl.name
$$;

CREATE OR REPLACE FUNCTION public.customer_ops_roster(_location uuid)
RETURNS TABLE(personnel_id uuid, first_name text, last_name text, phone text, role_label text, on_location boolean, assigned_at timestamptz, unassigned_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.customer_ops_location_ok(_location) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH loc AS (SELECT project_id FROM project_locations WHERE id = _location),
  ids AS (
    SELECT ppa.personnel_id FROM personnel_project_assignments ppa, loc WHERE ppa.project_id = loc.project_id AND ppa.status = 'active'
    UNION SELECT a.personnel_id FROM location_assignments a WHERE a.location_id = _location)
  SELECT pe.id, pe.first_name, pe.last_name, pe.phone, a.role_label, coalesce(a.status = 'active', false), a.assigned_at, a.unassigned_at
  FROM ids JOIN personnel pe ON pe.id = ids.personnel_id
  LEFT JOIN location_assignments a ON a.location_id = _location AND a.personnel_id = pe.id
  WHERE pe.deleted_at IS NULL AND pe.merged_into_id IS NULL
  ORDER BY coalesce(a.status = 'active', false) DESC, pe.last_name, pe.first_name;
END $$;

CREATE OR REPLACE FUNCTION public.customer_ops_attendance(_location uuid, _from date, _to date)
RETURNS TABLE(visit_personnel_id uuid, personnel_id uuid, first_name text, last_name text, local_day date, in_at timestamptz, out_at timestamptz, hours numeric, signed boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE z text;
BEGIN
  IF NOT public.customer_ops_location_ok(_location) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF _to < _from OR _to - _from > 62 THEN RAISE EXCEPTION 'Choose a range of 62 days or less'; END IF;
  SELECT coalesce(pl.timezone, 'America/Chicago') INTO z FROM project_locations pl WHERE pl.id = _location;
  RETURN QUERY
  SELECT t.visit_personnel_id, t.personnel_id, t.first_name, t.last_name, (t.in_at AT TIME ZONE z)::date,
         t.in_at, t.out_at, t.hours, t.signature_url IS NOT NULL
  FROM personnel_location_trail t
  WHERE t.location_id = _location AND t.in_at >= (_from::timestamp AT TIME ZONE z) - interval '1 day'
    AND t.in_at < ((_to + 1)::timestamp AT TIME ZONE z) + interval '1 day'
    AND (t.in_at AT TIME ZONE z)::date BETWEEN _from AND _to
  ORDER BY t.in_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.customer_ops_sheets(_location uuid)
RETURNS TABLE(sheet_day_id uuid, sheet_date date, status text, countersign_name text, countersigned_at timestamptz, has_pdf boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.customer_ops_location_ok(_location) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT d.id, d.sheet_date, d.status, d.countersign_name, d.countersigned_at, d.pdf_url IS NOT NULL
    FROM signin_sheet_days d WHERE d.location_id = _location ORDER BY d.sheet_date DESC LIMIT 120;
END $$;

-- ===== Writes: project roster only, audited =====
CREATE OR REPLACE FUNCTION public.customer_ops_set_assignment(_location uuid, _personnel uuid, _assign boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE loc record; prev record; uemail text;
BEGIN
  IF NOT public.customer_ops_location_ok(_location) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  SELECT id, project_id, status INTO loc FROM project_locations WHERE id = _location;
  IF loc.status = 'closed' THEN RAISE EXCEPTION 'This location is closed'; END IF;
  SELECT * INTO prev FROM location_assignments WHERE location_id = _location AND personnel_id = _personnel FOR UPDATE;
  IF _assign THEN
    IF NOT EXISTS (SELECT 1 FROM personnel_project_assignments WHERE project_id = loc.project_id AND personnel_id = _personnel AND status = 'active') THEN
      RAISE EXCEPTION 'Only people already on the project roster can be assigned';
    END IF;
    IF prev.id IS NULL THEN
      INSERT INTO location_assignments(location_id, personnel_id, assigned_by) VALUES (_location, _personnel, auth.uid());
    ELSIF prev.status <> 'active' THEN
      UPDATE location_assignments SET status = 'active', unassigned_at = NULL, assigned_at = now(), assigned_by = auth.uid() WHERE id = prev.id;
    ELSE RETURN jsonb_build_object('ok', true, 'unchanged', true); END IF;
  ELSE
    IF prev.id IS NULL OR prev.status <> 'active' THEN RETURN jsonb_build_object('ok', true, 'unchanged', true); END IF;
    UPDATE location_assignments SET status = 'unassigned', unassigned_at = now() WHERE id = prev.id;
  END IF;
  SELECT email INTO uemail FROM auth.users WHERE id = auth.uid();
  INSERT INTO audit_logs(user_id, user_email, action_type, resource_type, resource_id, success, metadata)
  VALUES (auth.uid(), coalesce(uemail, ''), CASE WHEN _assign THEN 'customer_assign' ELSE 'customer_unassign' END,
          'location_assignment', _location::text, true, jsonb_build_object('personnel_id', _personnel, 'location_id', _location));
  RETURN jsonb_build_object('ok', true);
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['public.customer_ops_locations()','public.customer_ops_roster(uuid)','public.customer_ops_attendance(uuid,date,date)',
    'public.customer_ops_sheets(uuid)','public.customer_ops_set_assignment(uuid,uuid,boolean)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;
