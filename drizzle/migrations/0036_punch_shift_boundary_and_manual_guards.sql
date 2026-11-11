CREATE OR REPLACE FUNCTION public._shift_start_for(p_location uuid,p_at timestamptz) RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE l record; z text; ds time; ns time; d date; upcoming timestamptz; prior timestamptz;
BEGIN
 SELECT pl.*,to_jsonb(p) project INTO l FROM project_locations pl JOIN projects p ON p.id=pl.project_id WHERE pl.id=p_location;IF NOT FOUND THEN RETURN NULL;END IF;
 z:=COALESCE(l.timezone,l.project->>'timezone','America/Chicago');ds:=COALESCE(l.day_shift_start,(l.project->>'day_shift_start')::time,'06:00');ns:=COALESCE(l.night_shift_start,(l.project->>'night_shift_start')::time,'18:00');d:=(p_at AT TIME ZONE z)::date;
 SELECT min(b) FILTER(WHERE b>=p_at),max(b) FILTER(WHERE b<=p_at) INTO upcoming,prior FROM (SELECT (day::date+tm) AT TIME ZONE z b FROM generate_series(d-1,d+1,interval '1 day') day CROSS JOIN unnest(ARRAY[ds,ns]) tm) shifts;
 IF upcoming-p_at<=interval '2 hours' THEN RETURN upcoming;END IF;
 -- Morning arrivals before the first day shift keep the existing reason/early-review path.
 IF (p_at AT TIME ZONE z)::time<ds AND (p_at AT TIME ZONE z)::time>=time '04:00' THEN RETURN (d+ds) AT TIME ZONE z;END IF;
 RETURN prior;
END $$;
DO $ddl$ DECLARE s text;BEGIN
s:=pg_get_functiondef('public._punch_core(uuid,uuid,double precision,double precision,double precision,text,timestamptz,text,text)'::regprocedure);
s:=replace(s,'vp.manual_time_override, lv.check_in_at AS visit_in','vp.manual_time_override, lv.notes AS visit_notes, lv.check_in_at AS visit_in');
s:=replace(s,'NOT COALESCE(v_vp.manual_time_override,false) AND v_end','NOT (COALESCE(v_vp.manual_time_override,false) OR COALESCE(v_vp.visit_notes,'''') ILIKE ''manual entry%'') AND v_end');
s:=replace(s,'AND COALESCE(vp.checked_in_at, lv.check_in_at) <= v_eff + interval ''12 hours''','AND (COALESCE(vp.checked_in_at,lv.check_in_at) AT TIME ZONE v_tz)::date >= (v_eff AT TIME ZONE v_tz)::date-1 AND COALESCE(vp.checked_in_at, lv.check_in_at) <= v_eff + interval ''12 hours''');
EXECUTE s;END $ddl$;
CREATE OR REPLACE FUNCTION public.review_punch_shift(p_id uuid,p_kind text,p_status text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); s record;
BEGIN
 IF uid IS NULL OR NOT(public.has_role(uid,'admin') OR public.has_role(uid,'manager')) THEN RAISE EXCEPTION 'Manager access required';END IF;
 IF p_kind NOT IN ('early','extension') OR p_status NOT IN ('approved','denied') THEN RAISE EXCEPTION 'Invalid review';END IF;
 IF p_kind='early' THEN
  IF p_status='denied' THEN RAISE EXCEPTION 'Correct early time through audited manual edit';END IF;
  UPDATE visit_personnel SET offsite_approved_by=uid,offsite_approved_at=clock_timestamp() WHERE id=p_id AND early_in_reason IS NOT NULL AND offsite_approved_at IS NULL RETURNING * INTO s;
 ELSE
  UPDATE shift_extensions SET status=p_status,decided_by=uid,decided_at=clock_timestamp() WHERE id=p_id AND status='pending' RETURNING * INTO s;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Review changed; refresh';END IF;
 INSERT INTO audit_logs(user_id,user_email,action_type,resource_type,resource_id,changes_after) VALUES(uid,'shift-review','shift_review',CASE WHEN p_kind='early' THEN 'visit_personnel' ELSE 'shift_extensions' END,p_id,jsonb_build_object('status',p_status,'kind',p_kind));
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.review_punch_shift(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_punch_shift(uuid,text,text) TO authenticated,service_role;