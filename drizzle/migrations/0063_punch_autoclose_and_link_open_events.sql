ALTER TABLE public.visit_personnel ADD COLUMN auto_closed_at timestamptz, ADD COLUMN auto_close_reason text, ADD COLUMN reported_out_at timestamptz;
COMMENT ON COLUMN public.visit_personnel.reported_out_at IS 'Worker-reported checkout through a correction request, not an actual device punch';
CREATE TABLE public.punch_link_events(id uuid PRIMARY KEY,personnel_id uuid NOT NULL,location_id uuid NOT NULL REFERENCES public.project_locations(id),visit_personnel_id uuid REFERENCES public.visit_personnel(id),opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),local_date date NOT NULL,lat double precision,lng double precision,accuracy_m double precision,gps_status text NOT NULL);
GRANT SELECT ON public.punch_link_events TO authenticated;
GRANT ALL ON public.punch_link_events TO service_role;
ALTER TABLE public.punch_link_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY manager_read ON public.punch_link_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE INDEX punch_link_events_location_day ON public.punch_link_events(location_id,local_date,personnel_id);
CREATE OR REPLACE FUNCTION public.record_punch_link_open(p_token uuid,p_id uuid,p_lat double precision DEFAULT NULL,p_lng double precision DEFAULT NULL,p_accuracy double precision DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t record;z text;sid uuid;d date;
BEGIN
 SELECT * INTO t FROM site_checkin_tokens WHERE id=p_token AND expires_at>now();IF NOT FOUND THEN RETURN jsonb_build_object('ok',false);END IF;
 IF (p_lat IS NULL)<>(p_lng IS NULL) OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 OR p_accuracy<0 OR p_accuracy>100000 THEN RAISE EXCEPTION 'Invalid coordinates';END IF;
 SELECT COALESCE(l.timezone,to_jsonb(p)->>'timezone','America/Chicago') INTO z FROM project_locations l JOIN projects p ON p.id=l.project_id WHERE l.id=t.location_id;
 d:=(clock_timestamp() AT TIME ZONE z)::date;
 IF EXISTS(SELECT 1 FROM punch_link_events WHERE personnel_id=t.personnel_id AND location_id=t.location_id AND opened_at>now()-interval '10 seconds') THEN RETURN jsonb_build_object('ok',true);END IF;
 SELECT vp.id INTO sid FROM visit_personnel vp JOIN location_visits lv ON lv.id=vp.visit_id WHERE vp.personnel_id=t.personnel_id AND lv.location_id=t.location_id AND (COALESCE(vp.checked_in_at,lv.check_in_at) AT TIME ZONE z)::date=d ORDER BY vp.checked_in_at DESC LIMIT 1;
 INSERT INTO punch_link_events(id,personnel_id,location_id,visit_personnel_id,local_date,lat,lng,accuracy_m,gps_status) VALUES(p_id,t.personnel_id,t.location_id,sid,d,p_lat,p_lng,p_accuracy,CASE WHEN p_lat IS NULL THEN 'unavailable' ELSE 'captured' END) ON CONFLICT(id) DO NOTHING;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.record_punch_link_open(uuid,uuid,double precision,double precision,double precision) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_punch_link_open(uuid,uuid,double precision,double precision,double precision) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.scheduled_close_punches(p_at timestamptz DEFAULT now(),p_dry boolean DEFAULT true,p_location uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s record;e timestamptz;r jsonb:='[]'::jsonb;ext record;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service access required';END IF;
 IF NOT p_dry AND (p_at>now()+interval '1 minute' OR p_at<now()-interval '1 minute' OR p_location IS NOT NULL) THEN RAISE EXCEPTION 'Simulation requires dry run';END IF;
 FOR s IN SELECT vp.*,lv.location_id,lv.check_in_at visit_in,l.project_id,COALESCE(l.timezone,to_jsonb(p)->>'timezone','America/Chicago') tz FROM visit_personnel vp JOIN location_visits lv ON lv.id=vp.visit_id JOIN project_locations l ON l.id=lv.location_id JOIN projects p ON p.id=l.project_id WHERE l.status='active' AND vp.checked_out_at IS NULL AND lv.check_out_at IS NULL AND vp.actual_out_at IS NULL AND NOT vp.manual_time_override AND COALESCE(lv.notes,'') NOT ILIKE 'manual entry%' AND COALESCE(vp.checked_in_at,lv.check_in_at)>=p_at-interval '48 hours' AND (p_location IS NULL OR l.id=p_location) ORDER BY vp.id LIMIT 500
 LOOP
  e:=COALESCE(s.scheduled_end_at,public._shift_end_for(s.location_id,COALESCE(s.checked_in_at,s.visit_in)));
  SELECT * INTO ext FROM shift_extensions WHERE personnel_id=s.personnel_id AND location_id=s.location_id AND ext_date=(COALESCE(s.scheduled_start_at,s.checked_in_at,s.visit_in) AT TIME ZONE s.tz)::date;
  IF ext.status='approved' THEN e:=GREATEST(e,ext.until_at);END IF;
  IF e IS NULL OR e>p_at OR e<=COALESCE(s.checked_in_at,s.visit_in) THEN CONTINUE;END IF;
  BEGIN
   PERFORM pg_advisory_xact_lock(hashtextextended(s.location_id::text||s.personnel_id::text,0));
   PERFORM 1 FROM visit_personnel WHERE id=s.id AND checked_out_at IS NULL AND actual_out_at IS NULL FOR UPDATE;IF NOT FOUND THEN CONTINUE;END IF;
   PERFORM public._guard_punch_recount(s.id,COALESCE(s.checked_in_at,s.visit_in),e);
   IF NOT p_dry THEN
    UPDATE visit_personnel SET checked_out_at=e,auto_closed_at=clock_timestamp(),auto_close_reason='forgot to clock out',scheduled_end_at=COALESCE(scheduled_end_at,public._shift_end_for(s.location_id,COALESCE(s.checked_in_at,s.visit_in))) WHERE id=s.id;
    PERFORM public._refresh_punch_attendance(s.id);
    INSERT INTO audit_logs(user_email,action_type,resource_type,resource_id,changes_before,changes_after) VALUES('scheduled-job','scheduled_auto_close','visit_personnel',s.id,jsonb_build_object('out',NULL),jsonb_build_object('out',e,'actual_out',NULL,'reason','forgot to clock out'));
   END IF;
   r:=r||jsonb_build_array(jsonb_build_object('stay_id',s.id,'personnel_id',s.personnel_id,'location_id',s.location_id,'end_at',e,'timezone',s.tz,'shift_date',(COALESCE(s.scheduled_start_at,s.checked_in_at,s.visit_in) AT TIME ZONE s.tz)::date));
  EXCEPTION WHEN OTHERS THEN
   r:=r||jsonb_build_array(jsonb_build_object('stay_id',s.id,'blocked',true));
  END;
 END LOOP;
 RETURN jsonb_build_object('dry_run',p_dry,'entries',r);
END $$;
REVOKE ALL ON FUNCTION public.scheduled_close_punches(timestamptz,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scheduled_close_punches(timestamptz,boolean,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.request_closed_shift_extension(p_token uuid,p_reason text,p_until timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t record;s record;z text;u timestamptz;d date;rid uuid;
BEGIN
 SELECT * INTO t FROM site_checkin_tokens WHERE id=p_token AND expires_at>now();IF NOT FOUND THEN RETURN jsonb_build_object('ok',false);END IF;
 IF length(trim(COALESCE(p_reason,''))) NOT BETWEEN 1 AND 200 THEN RETURN jsonb_build_object('ok',false,'reason','reason_required');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t.location_id::text||t.personnel_id::text,0));
 SELECT vp.*,COALESCE(l.timezone,to_jsonb(p)->>'timezone','America/Chicago') tz INTO s FROM visit_personnel vp JOIN location_visits lv ON lv.id=vp.visit_id JOIN project_locations l ON l.id=lv.location_id JOIN projects p ON p.id=l.project_id WHERE vp.personnel_id=t.personnel_id AND lv.location_id=t.location_id AND vp.auto_closed_at>now()-interval '48 hours' AND NOT vp.manual_time_override AND l.status='active' ORDER BY vp.auto_closed_at DESC LIMIT 1 FOR UPDATE OF vp;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false);END IF;
 u:=to_timestamp(floor(extract(epoch FROM p_until)/900)*900);
 IF u IS NULL OR u<=s.scheduled_end_at OR u>now() OR u>s.scheduled_end_at+interval '6 hours' THEN RETURN jsonb_build_object('ok',false,'reason','bad_until');END IF;
 PERFORM public._guard_punch_recount(s.id,s.checked_in_at,u);
 UPDATE visit_personnel SET reported_out_at=u WHERE id=s.id;
 d:=(COALESCE(s.scheduled_start_at,s.checked_in_at) AT TIME ZONE s.tz)::date;
 INSERT INTO shift_extensions(personnel_id,location_id,ext_date,reason,until_at) VALUES(t.personnel_id,t.location_id,d,trim(p_reason),u) ON CONFLICT(personnel_id,location_id,ext_date) DO UPDATE SET reason=EXCLUDED.reason,until_at=EXCLUDED.until_at,status='pending',requested_at=now(),decided_by=NULL,decided_at=NULL RETURNING id INTO rid;
 INSERT INTO admin_notifications(user_id,title,message,notification_type,link_url,related_id,priority) SELECT DISTINCT user_id,'Late checkout correction','Worker reported '+to_char(u AT TIME ZONE s.tz,'HH24MI')||' after scheduled auto-close — review extra time','shift_extension','/approvals',rid,'high' FROM user_roles WHERE role IN ('admin','manager');
 RETURN jsonb_build_object('ok',true,'until',u,'status','pending');
END $$;
REVOKE ALL ON FUNCTION public.request_closed_shift_extension(uuid,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_closed_shift_extension(uuid,text,timestamptz) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.recount_approved_punch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s record;i timestamptz;o timestamptz;mins integer;
BEGIN
 IF TG_TABLE_NAME='shift_extensions' THEN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('approved','denied') THEN RETURN NEW;END IF;
  FOR s IN SELECT vp.*,lv.location_id,pl.project_id,COALESCE(pl.timezone,'America/Chicago') tz,p.checkout_rounding_minutes FROM visit_personnel vp JOIN location_visits lv ON lv.id=vp.visit_id JOIN project_locations pl ON pl.id=lv.location_id JOIN projects p ON p.id=pl.project_id WHERE lv.location_id=NEW.location_id AND vp.personnel_id=NEW.personnel_id AND vp.scheduled_end_at IS NOT NULL AND NOT vp.manual_time_override AND (COALESCE(vp.scheduled_start_at,vp.checked_in_at) AT TIME ZONE COALESCE(pl.timezone,'America/Chicago'))::date=NEW.ext_date AND COALESCE(vp.actual_out_at,CASE WHEN vp.auto_closed_at IS NOT NULL THEN vp.reported_out_at END)>vp.scheduled_end_at LOOP
   i:=s.checked_in_at;o:=CASE WHEN NEW.status='approved' AND NEW.until_at>=COALESCE(s.actual_out_at,s.reported_out_at) THEN COALESCE(s.actual_out_at,s.reported_out_at) ELSE s.scheduled_end_at END;mins:=GREATEST(COALESCE(s.checkout_rounding_minutes,15),1);o:=GREATEST(to_timestamp(floor(extract(epoch FROM o)/(mins*60))*(mins*60)),i+interval '1 second');
   PERFORM public._guard_punch_recount(s.id,i,o);
   UPDATE visit_personnel SET checked_out_at=o WHERE id=s.id;PERFORM public._refresh_punch_attendance(s.id);
   INSERT INTO audit_logs(user_id,user_email,action_type,resource_type,resource_id,changes_before,changes_after,metadata) VALUES(NEW.decided_by,'shift-review','shift_extension_recount','visit_personnel',s.id,jsonb_build_object('out',s.checked_out_at),jsonb_build_object('out',o,'actual_out',s.actual_out_at,'reported_out',s.reported_out_at),jsonb_build_object('extension_id',NEW.id,'status',NEW.status));
  END LOOP;
 ELSE
  IF OLD.offsite_approved_at IS NULL AND NEW.offsite_approved_at IS NOT NULL AND NEW.early_in_reason IS NOT NULL AND NEW.scheduled_start_at IS NOT NULL AND NOT NEW.manual_time_override AND NEW.actual_in_at<NEW.checked_in_at THEN
   PERFORM public._guard_punch_recount(NEW.id,NEW.actual_in_at,NEW.checked_out_at);
   UPDATE visit_personnel SET checked_in_at=NEW.actual_in_at WHERE id=NEW.id;PERFORM public._refresh_punch_attendance(NEW.id);
   INSERT INTO audit_logs(user_id,user_email,action_type,resource_type,resource_id,changes_before,changes_after) VALUES(NEW.offsite_approved_by,'shift-review','early_punch_recount','visit_personnel',NEW.id,jsonb_build_object('in',NEW.checked_in_at),jsonb_build_object('in',NEW.actual_in_at));
  END IF;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.recount_approved_punch() FROM PUBLIC,anon,authenticated;