CREATE OR REPLACE FUNCTION public.get_join_info(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE t record;
BEGIN
  SELECT jt.*, p.name AS project_name, pl.name AS location_name,
    v.name AS agency_name, v.logo_url AS agency_logo_url INTO t
  FROM public.project_join_tokens jt
  JOIN public.projects p ON p.id = jt.project_id
  LEFT JOIN public.project_locations pl ON pl.id = jt.location_id
  LEFT JOIN public.vendors v ON v.id = jt.vendor_id
  WHERE jt.id = p_token AND jt.active AND now() <= jt.expires_at;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false); END IF;
  RETURN jsonb_build_object('valid', true, 'project_name', t.project_name,
    'location_name', t.location_name, 'role_label', t.role_label,
    'agency_name', t.agency_name, 'agency_logo_url', t.agency_logo_url);
END $function$;
