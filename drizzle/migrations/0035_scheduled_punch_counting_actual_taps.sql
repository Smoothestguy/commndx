ALTER TABLE public.visit_personnel ADD COLUMN actual_in_at timestamptz, ADD COLUMN actual_out_at timestamptz, ADD COLUMN scheduled_start_at timestamptz, ADD COLUMN scheduled_end_at timestamptz, ADD COLUMN manual_time_override boolean NOT NULL DEFAULT false;
UPDATE public.visit_personnel vp SET actual_in_at=COALESCE(vp.checked_in_at,lv.check_in_at),actual_out_at=COALESCE(vp.checked_out_at,lv.check_out_at) FROM public.location_visits lv WHERE lv.id=vp.visit_id;
COMMENT ON COLUMN public.visit_personnel.actual_in_at IS 'Actual device tap; existing historical counted values copied without recounting';
COMMENT ON COLUMN public.visit_personnel.scheduled_start_at IS 'Punch-time frozen schedule; NULL for legacy/manual stays';
CREATE OR REPLACE FUNCTION public._shift_end_for(p_location uuid,p_in timestamptz) RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE l record; z text; ds time; ns time; e time; d date; t time;
BEGIN
 SELECT pl.*,to_jsonb(p) AS project INTO l FROM project_locations pl JOIN projects p ON p.id=pl.project_id WHERE pl.id=p_location;
 IF NOT FOUND THEN RETURN NULL; END IF;
 z:=COALESCE(l.timezone,l.project->>'timezone','America/Chicago'); ds:=COALESCE(l.day_shift_start,(l.project->>'day_shift_start')::time,'06:00'); ns:=COALESCE(l.night_shift_start,(l.project->>'night_shift_start')::time,'18:00'); d:=(p_in AT TIME ZONE z)::date;t:=(p_in AT TIME ZONE z)::time;
 IF t>=ds AND t<ns THEN e:=COALESCE(l.day_shift_end,(l.project->>'day_shift_end')::time,ns); IF e<=ds THEN d:=d+1;END IF;
 ELSE e:=COALESCE(l.night_shift_end,(l.project->>'night_shift_end')::time,ds);IF t>=ns AND e<=ns THEN d:=d+1;END IF; END IF;
 RETURN (d+e) AT TIME ZONE z;
END $$;
DO $ddl$ DECLARE s text; BEGIN
 s:=pg_get_functiondef('public._shift_start_for(uuid,timestamptz)'::regprocedure); s:=replace(s,'p.night_shift_start AS p_night','p.night_shift_start AS p_night, to_jsonb(p)->>''timezone'' AS p_timezone');s:=replace(s,'COALESCE(loc.timezone, ''America/Chicago'')','COALESCE(loc.timezone, loc.p_timezone, ''America/Chicago'')'); EXECUTE s;
END $ddl$;
CREATE OR REPLACE FUNCTION public._guard_punch_recount(p_stay uuid,p_in timestamptz,p_out timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l record; old_in timestamptz; old_out timestamptz;
BEGIN
 SELECT pl.id,pl.project_id,COALESCE(pl.timezone,'America/Chicago') tz INTO l FROM visit_personnel vp JOIN location_visits lv ON lv.id=vp.visit_id JOIN project_locations pl ON pl.id=lv.location_id WHERE vp.id=p_stay;
 SELECT COALESCE(vp.checked_in_at,lv.check_in_at),COALESCE(vp.checked_out_at,lv.check_out_at) INTO old_in,old_out FROM visit_personnel vp JOIN location_visits lv ON lv.id=vp.visit_id WHERE vp.id=p_stay;
 IF EXISTS(SELECT 1 FROM time_entries WHERE visit_personnel_id=p_stay AND (is_locked OR invoice_id IS NOT NULL)) OR EXISTS(SELECT 1 FROM time_week_closeouts WHERE project_id=l.project_id AND status='closed' AND week_start_date<=(GREATEST(COALESCE(old_out,old_in),COALESCE(p_out,p_in)) AT TIME ZONE 'America/Chicago')::date AND week_end_date>=(LEAST(old_in,p_in) AT TIME ZONE 'America/Chicago')::date) OR EXISTS(SELECT 1 FROM signin_sheet_days WHERE location_id=l.id AND status='locked' AND sheet_date BETWEEN (LEAST(old_in,p_in) AT TIME ZONE l.tz)::date AND (GREATEST(COALESCE(old_out,old_in),COALESCE(p_out,p_in)) AT TIME ZONE l.tz)::date) THEN RAISE EXCEPTION 'Attendance or payroll is locked; reopen before approval';END IF;
END $$;
REVOKE ALL ON FUNCTION public._guard_punch_recount(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public._refresh_punch_attendance(p_stay uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s record; d date; h numeric;
BEGIN
 SELECT vp.personnel_id,lv.location_id,COALESCE(pl.timezone,'America/Chicago') tz,COALESCE(vp.checked_in_at,lv.check_in_at) i,COALESCE(vp.checked_out_at,lv.check_out_at) o INTO s FROM visit_personnel vp JOIN location_visits lv ON lv.id=vp.visit_id JOIN project_locations pl ON pl.id=lv.location_id WHERE vp.id=p_stay;
 IF s.o IS NULL THEN RETURN;END IF;
 FOR d IN SELECT generate_series((s.i AT TIME ZONE s.tz)::date,(s.o AT TIME ZONE s.tz)::date,'1 day')::date LOOP
 SELECT COALESCE(sum(GREATEST(0,extract(epoch FROM LEAST(COALESCE(vp.checked_out_at,lv.check_out_at),(d+1)::timestamp AT TIME ZONE s.tz)-GREATEST(COALESCE(vp.checked_in_at,lv.check_in_at),d::timestamp AT TIME ZONE s.tz))/3600)),0) INTO h FROM visit_personnel vp JOIN location_visits lv ON lv.id=vp.visit_id WHERE lv.location_id=s.location_id AND vp.personnel_id=s.personnel_id AND COALESCE(vp.checked_out_at,lv.check_out_at) IS NOT NULL;
 INSERT INTO location_attendance(location_id,personnel_id,att_date,status,hours) VALUES(s.location_id,s.personnel_id,d,'worked',LEAST(round(h,1),24)) ON CONFLICT(location_id,personnel_id,att_date) DO UPDATE SET hours=EXCLUDED.hours,status='worked';
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public._refresh_punch_attendance(uuid) FROM PUBLIC,anon,authenticated;
DO $ddl$ DECLARE s text; BEGIN
s:=pg_get_functiondef('public._punch_core(uuid,uuid,double precision,double precision,double precision,text,timestamptz,text,text)'::regprocedure);
s:=replace(s,'v_autoclose numeric;','v_autoclose numeric; v_actual timestamptz; v_end timestamptz; v_ext record; v_request uuid;');
s:=replace(s,'COALESCE(loc.timezone, ''America/Chicago'')','COALESCE(loc.timezone, to_jsonb(prj)->>''timezone'', ''America/Chicago'')');
s:=replace(s,'v_late := p_at','v_actual := v_eff; PERFORM pg_advisory_xact_lock(hashtextextended(p_location::text || p_personnel::text,0)); v_late := p_at');
s:=replace(s,'vp.checked_in_at, lv.check_in_at AS visit_in','vp.checked_in_at, vp.scheduled_end_at, vp.scheduled_start_at, vp.manual_time_override, lv.check_in_at AS visit_in');
s:=replace(s,'AND (COALESCE(vp.checked_in_at, lv.check_in_at) AT TIME ZONE v_tz)::date = (v_eff AT TIME ZONE v_tz)::date'||chr(10)||'  ORDER BY','AND COALESCE(vp.checked_in_at, lv.check_in_at) <= v_eff + interval ''12 hours'''||chr(10)||'  ORDER BY');
s:=replace(s,'    v_out := to_timestamp',$code$
    v_end := COALESCE(v_vp.scheduled_end_at, public._shift_end_for(p_location, COALESCE(v_vp.checked_in_at,v_vp.visit_in)));
    SELECT * INTO v_ext FROM shift_extensions WHERE personnel_id=p_personnel AND location_id=p_location AND ext_date=(COALESCE(v_vp.scheduled_start_at,v_vp.checked_in_at,v_vp.visit_in) AT TIME ZONE v_tz)::date;
    IF NOT COALESCE(v_vp.manual_time_override,false) AND v_end IS NOT NULL AND v_eff > v_end THEN
      IF v_ext.status='approved' AND v_ext.until_at >= v_eff THEN NULL;
      ELSE
        v_eff := v_end;
        IF v_ext.id IS NULL THEN
          INSERT INTO shift_extensions(personnel_id,location_id,ext_date,reason,until_at)
          VALUES(p_personnel,p_location,(COALESCE(v_vp.scheduled_start_at,v_vp.checked_in_at,v_vp.visit_in) AT TIME ZONE v_tz)::date,'Late checkout: approve actual tap as extra time',v_actual) RETURNING id INTO v_request;
        ELSIF v_ext.status <> 'denied' THEN
          UPDATE shift_extensions SET until_at=GREATEST(until_at,v_actual),status='pending',decided_at=NULL,decided_by=NULL WHERE id=v_ext.id RETURNING id INTO v_request;
        END IF;
        INSERT INTO admin_notifications(user_id,title,message,notification_type,link_url,related_id,priority)
        SELECT DISTINCT ur.user_id,'Extra time approval',
          (SELECT concat(first_name,' ',last_name) FROM personnel WHERE id=p_personnel)||' clocked out '||to_char(v_actual AT TIME ZONE v_tz,'HH24:MI')||', schedule ends '||to_char(v_end AT TIME ZONE v_tz,'HH24:MI')||' ('||v_tz||') — approve extra time?',
          'shift_extension','/locations/'||p_location::text,COALESCE(v_request,v_ext.id),'high'
        FROM user_roles ur WHERE ur.role IN ('admin','manager')
        UNION
        SELECT per.user_id,'Extra time approval',
          (SELECT concat(first_name,' ',last_name) FROM personnel WHERE id=p_personnel)||' clocked out '||to_char(v_actual AT TIME ZONE v_tz,'HH24:MI')||', schedule ends '||to_char(v_end AT TIME ZONE v_tz,'HH24:MI')||' ('||v_tz||') — approve extra time?',
          'shift_extension','/locations/'||p_location::text,COALESCE(v_request,v_ext.id),'high'
        FROM location_assignments la JOIN personnel per ON per.id=la.personnel_id
        WHERE la.location_id=p_location AND la.status='active' AND la.role_label ILIKE '%supervisor%' AND per.user_id IS NOT NULL;
      END IF;
    END IF;
    PERFORM public._guard_punch_recount(v_vp.id,COALESCE(v_vp.checked_in_at,v_vp.visit_in),v_eff);
    v_out := to_timestamp$code$);
s:=replace(s,'SET checked_out_at = v_out, synced_late','SET actual_out_at = v_actual, checked_out_at = v_out, synced_late');
s:=replace(s,'''at'', v_out);','''at'', v_out, ''actual_at'', v_actual, ''extra_pending'', v_request IS NOT NULL);');
s:=replace(s,'    END IF;'||chr(10)||'  END IF;'||chr(10)||chr(10)||'  IF (v_early','    END IF;'||chr(10)||'    v_eff := v_shift_start;'||chr(10)||'  END IF;'||chr(10)||chr(10)||'  IF (v_early');
s:=replace(s,'checked_in_at, distance_m, accuracy_m, in_geofence, offsite_reason, synced_late, early_in_reason','checked_in_at, actual_in_at, scheduled_start_at, scheduled_end_at, distance_m, accuracy_m, in_geofence, offsite_reason, synced_late, early_in_reason');
s:=replace(s,'VALUES (v_visit, p_personnel, v_eff, v_dist','VALUES (v_visit, p_personnel, v_eff, v_actual, v_shift_start, public._shift_end_for(p_location,GREATEST(v_eff,v_shift_start)), v_dist');
s:=replace(s,'SET checked_in_at = EXCLUDED.checked_in_at, checked_out_at = NULL,','SET checked_in_at = EXCLUDED.checked_in_at, checked_out_at = NULL, actual_in_at=EXCLUDED.actual_in_at, actual_out_at=NULL, scheduled_start_at=EXCLUDED.scheduled_start_at, scheduled_end_at=EXCLUDED.scheduled_end_at,');
s:=replace(s,'''action'', ''in'', ''at'', v_eff,','''action'', ''in'', ''at'', v_eff, ''actual_at'', v_actual,');
EXECUTE s;
END $ddl$;
CREATE OR REPLACE FUNCTION public._punch_core(p_location uuid,p_personnel uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_override_reason text,p_at timestamptz) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public._punch_core(p_location,p_personnel,p_lat,p_lng,p_accuracy,p_override_reason,p_at,NULL::text,NULL::text) $$;
REVOKE ALL ON FUNCTION public._punch_core(uuid,uuid,double precision,double precision,double precision,text,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public._punch_core(uuid,uuid,double precision,double precision,double precision,text,timestamptz,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._punch_core(uuid,uuid,double precision,double precision,double precision,text,timestamptz),public._punch_core(uuid,uuid,double precision,double precision,double precision,text,timestamptz,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.recount_approved_punch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s record; i timestamptz; o timestamptz; mins integer; changed boolean;
BEGIN
 IF TG_TABLE_NAME='shift_extensions' THEN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('approved','denied') THEN RETURN NEW;END IF;
  FOR s IN SELECT vp.*,lv.location_id,pl.project_id,COALESCE(pl.timezone,'America/Chicago') tz,p.checkout_rounding_minutes FROM visit_personnel vp JOIN location_visits lv ON lv.id=vp.visit_id JOIN project_locations pl ON pl.id=lv.location_id JOIN projects p ON p.id=pl.project_id WHERE lv.location_id=NEW.location_id AND vp.personnel_id=NEW.personnel_id AND vp.scheduled_end_at IS NOT NULL AND NOT vp.manual_time_override AND (COALESCE(vp.scheduled_start_at,vp.checked_in_at) AT TIME ZONE COALESCE(pl.timezone,'America/Chicago'))::date=NEW.ext_date AND vp.actual_out_at>vp.scheduled_end_at LOOP
   i:=s.checked_in_at;o:=CASE WHEN NEW.status='approved' AND NEW.until_at>=s.actual_out_at THEN s.actual_out_at ELSE s.scheduled_end_at END;mins:=GREATEST(COALESCE(s.checkout_rounding_minutes,15),1);o:=GREATEST(to_timestamp(floor(extract(epoch FROM o)/(mins*60))*(mins*60)),i+interval '1 second');
   PERFORM public._guard_punch_recount(s.id,i,o);
   UPDATE visit_personnel SET checked_out_at=o WHERE id=s.id;PERFORM public._refresh_punch_attendance(s.id);
   INSERT INTO audit_logs(user_id,user_email,action_type,resource_type,resource_id,changes_before,changes_after,metadata) VALUES(NEW.decided_by,'shift-review','shift_extension_recount','visit_personnel',s.id,jsonb_build_object('out',s.checked_out_at),jsonb_build_object('out',o,'actual_out',s.actual_out_at),jsonb_build_object('extension_id',NEW.id,'status',NEW.status));
  END LOOP;
 ELSE
  IF OLD.offsite_approved_at IS NULL AND NEW.offsite_approved_at IS NOT NULL AND NEW.early_in_reason IS NOT NULL AND NEW.scheduled_start_at IS NOT NULL AND NOT NEW.manual_time_override AND NEW.actual_in_at<NEW.checked_in_at THEN
   PERFORM public._guard_punch_recount(NEW.id,NEW.actual_in_at,NEW.checked_out_at);
   UPDATE visit_personnel SET checked_in_at=NEW.actual_in_at WHERE id=NEW.id;PERFORM public._refresh_punch_attendance(NEW.id);
   INSERT INTO audit_logs(user_id,user_email,action_type,resource_type,resource_id,changes_before,changes_after) VALUES(NEW.offsite_approved_by,'shift-review','early_punch_recount','visit_personnel',NEW.id,jsonb_build_object('in',NEW.checked_in_at),jsonb_build_object('in',NEW.actual_in_at));
  END IF;
 END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.recount_approved_punch() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER shift_extension_recount AFTER UPDATE OF status ON public.shift_extensions FOR EACH ROW EXECUTE FUNCTION public.recount_approved_punch();
CREATE TRIGGER early_punch_recount AFTER UPDATE OF offsite_approved_at ON public.visit_personnel FOR EACH ROW EXECUTE FUNCTION public.recount_approved_punch();
CREATE OR REPLACE FUNCTION public.preserve_actual_punch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.actual_in_at IS DISTINCT FROM OLD.actual_in_at OR (OLD.actual_out_at IS NOT NULL AND NEW.actual_out_at IS DISTINCT FROM OLD.actual_out_at) THEN RAISE EXCEPTION 'Actual punch evidence cannot be changed';END IF;
 RETURN NEW;END $$;
CREATE TRIGGER preserve_actual_punch BEFORE UPDATE ON public.visit_personnel FOR EACH ROW EXECUTE FUNCTION public.preserve_actual_punch();
CREATE OR REPLACE VIEW public.personnel_location_trail WITH(security_invoker=true) AS SELECT vp.id visit_personnel_id,vp.personnel_id,pd.first_name,pd.last_name,lv.id visit_id,lv.location_id,pl.name location_name,pl.project_id,lv.crew_id,COALESCE(vp.checked_in_at,lv.check_in_at) in_at,COALESCE(vp.checked_out_at,lv.check_out_at) out_at,round(extract(epoch FROM(COALESCE(vp.checked_out_at,lv.check_out_at)-COALESCE(vp.checked_in_at,lv.check_in_at)))/3600.0,2) hours,vp.signature_url,vp.checked_in_by,vp.actual_in_at,vp.actual_out_at FROM visit_personnel vp JOIN location_visits lv ON lv.id=vp.visit_id JOIN project_locations pl ON pl.id=lv.location_id LEFT JOIN personnel_directory pd ON pd.id=vp.personnel_id;
CREATE TRIGGER vp_counted_in_sync AFTER UPDATE OF checked_in_at ON public.visit_personnel FOR EACH ROW EXECUTE FUNCTION public.trg_vp_time_entry();