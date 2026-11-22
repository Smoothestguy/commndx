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
          'location_assignment', _location, true, jsonb_build_object('personnel_id', _personnel, 'location_id', _location));
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.customer_ops_set_assignment(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_ops_set_assignment(uuid,uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.create_personnel_override(p_payload jsonb, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cols text; vals text; v_id uuid; m record; uemail text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can create a duplicate' USING ERRCODE = '42501'; END IF;
  IF nullif(btrim(coalesce(p_reason,'')), '') IS NULL THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT string_agg(quote_ident(k), ','), string_agg(format('(r).%I', k), ',') INTO cols, vals
  FROM jsonb_object_keys(p_payload) k
  WHERE k NOT IN ('id','user_id','merged_into_id','deleted_at','created_at','updated_at')
    AND EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='personnel' AND c.column_name=k);
  IF cols IS NULL THEN RAISE EXCEPTION 'Nothing to insert'; END IF;
  SELECT * INTO m FROM public.personnel_duplicate_match(p_payload->>'first_name', p_payload->>'last_name', p_payload->>'email', p_payload->>'phone');
  PERFORM set_config('app.personnel_dup_override', 'on', true);
  EXECUTE format('INSERT INTO personnel(%s) SELECT %s FROM jsonb_populate_record(NULL::personnel, $1) r RETURNING id', cols, vals) USING p_payload INTO v_id;
  PERFORM set_config('app.personnel_dup_override', 'off', true);
  SELECT email INTO uemail FROM auth.users WHERE id = auth.uid();
  INSERT INTO audit_logs(user_id, user_email, action_type, resource_type, resource_id, success, metadata)
  VALUES (auth.uid(), coalesce(uemail,''), 'duplicate_create_anyway', 'personnel', v_id, true,
    jsonb_build_object('reason', btrim(p_reason), 'matched_personnel_id', m.personnel_id, 'matched_number', m.personnel_number, 'match_reason', m.reason));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.create_personnel_override(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_personnel_override(jsonb, text) TO authenticated;