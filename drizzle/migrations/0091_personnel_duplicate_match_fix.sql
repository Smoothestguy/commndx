CREATE OR REPLACE FUNCTION public.personnel_duplicate_match(p_first text, p_last text, p_email text, p_phone text)
RETURNS TABLE(personnel_id uuid, personnel_number text, full_name text, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ph text := public.normalize_phone(p_phone); e text := public.normalize_email(p_email);
  nm text := public.normalize_person_name(coalesce(p_first,'') || ' ' || coalesce(p_last,''));
BEGIN
  IF ph IS NOT NULL AND length(ph) < 10 THEN ph := NULL; END IF;
  IF e LIKE '%.invalid' THEN e := NULL; END IF;
  RETURN QUERY
  SELECT x.id, x.personnel_number, x.full_name, x.reason FROM (
    SELECT p.id, p.personnel_number, btrim(p.first_name || ' ' || p.last_name) AS full_name, p.created_at,
      CASE WHEN ph IS NOT NULL AND public.normalize_phone(p.phone) = ph THEN 'same_phone'
           WHEN e IS NOT NULL AND public.normalize_email(p.email) = e THEN 'same_email' ELSE 'same_name' END AS reason
    FROM personnel p
    WHERE p.deleted_at IS NULL AND p.merged_into_id IS NULL
      AND ((ph IS NOT NULL AND public.normalize_phone(p.phone) = ph)
        OR (e IS NOT NULL AND public.normalize_email(p.email) = e)
        OR (nm IS NOT NULL AND public.normalize_person_name(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) = nm))
  ) x
  ORDER BY (x.reason = 'same_phone') DESC, (x.reason = 'same_email') DESC, x.created_at
  LIMIT 1;
END $$;
REVOKE ALL ON FUNCTION public.personnel_duplicate_match(text,text,text,text) FROM PUBLIC, anon, authenticated;