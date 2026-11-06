CREATE OR REPLACE FUNCTION public.sync_requirements_from_task_orders(p_location uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Only managers can sync requirements';
  END IF;
  -- Locations without accepted task orders keep manually managed requirements.
  IF NOT EXISTS (SELECT 1 FROM location_task_orders WHERE location_id = p_location AND status = 'accepted') THEN
    RETURN;
  END IF;
  FOR r IN SELECT label, authorized FROM location_authorized_asof(p_location) WHERE line_kind = 'position' LOOP
    IF EXISTS (SELECT 1 FROM location_requirements WHERE location_id = p_location AND role_label = r.label) THEN
      UPDATE location_requirements SET headcount_needed = GREATEST(r.authorized, 0)
      WHERE location_id = p_location AND role_label = r.label;
    ELSE
      INSERT INTO location_requirements (location_id, role_label, headcount_needed)
      VALUES (p_location, r.label, GREATEST(r.authorized, 0));
    END IF;
  END LOOP;
  -- Requirements mirror task orders exactly: remove rows not backed by any task-order position line.
  DELETE FROM location_requirements lr
  WHERE lr.location_id = p_location
    AND lr.role_label NOT IN (
      SELECT DISTINCT l.label FROM location_task_order_lines l
      JOIN location_task_orders t ON t.id = l.task_order_id
      WHERE t.location_id = p_location AND t.status = 'accepted' AND l.line_kind = 'position');
  -- Roles fully demobilized go to zero.
  UPDATE location_requirements lr SET headcount_needed = 0
  WHERE lr.location_id = p_location
    AND lr.role_label NOT IN (SELECT label FROM location_authorized_asof(p_location) WHERE line_kind = 'position');
END $function$;
REVOKE EXECUTE ON FUNCTION public.sync_requirements_from_task_orders(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sync_requirements_from_task_orders(uuid) TO authenticated, service_role;