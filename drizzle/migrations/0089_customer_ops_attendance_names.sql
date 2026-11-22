CREATE OR REPLACE FUNCTION public.customer_ops_attendance(_location uuid, _from date, _to date)
RETURNS TABLE(visit_personnel_id uuid, personnel_id uuid, first_name text, last_name text, local_day date, in_at timestamptz, out_at timestamptz, hours numeric, signed boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE z text;
BEGIN
  IF NOT public.customer_ops_location_ok(_location) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF _to < _from OR _to - _from > 62 THEN RAISE EXCEPTION 'Choose a range of 62 days or less'; END IF;
  SELECT coalesce(pl.timezone, 'America/Chicago') INTO z FROM project_locations pl WHERE pl.id = _location;
  RETURN QUERY
  SELECT t.visit_personnel_id, t.personnel_id, pe.first_name, pe.last_name, (t.in_at AT TIME ZONE z)::date,
         t.in_at, t.out_at, t.hours, t.signature_url IS NOT NULL
  FROM personnel_location_trail t JOIN personnel pe ON pe.id = t.personnel_id
  WHERE t.location_id = _location AND t.in_at >= (_from::timestamp AT TIME ZONE z) - interval '1 day'
    AND t.in_at < ((_to + 1)::timestamp AT TIME ZONE z) + interval '1 day'
    AND (t.in_at AT TIME ZONE z)::date BETWEEN _from AND _to
  ORDER BY t.in_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.customer_ops_attendance(uuid,date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_ops_attendance(uuid,date,date) TO authenticated;