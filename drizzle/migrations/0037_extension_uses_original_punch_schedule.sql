CREATE OR REPLACE FUNCTION public.request_shift_extension(p_token uuid,p_reason text,p_until timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t record;s record;z text;e timestamptz;u timestamptz;d date;
BEGIN
 SELECT * INTO t FROM site_checkin_tokens WHERE id=p_token AND now()<=expires_at;IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','invalid');END IF;
 IF COALESCE(trim(p_reason),'')='' THEN RETURN jsonb_build_object('ok',false,'reason','reason_required');END IF;
 SELECT vp.*,lv.check_in_at visit_in INTO s FROM visit_personnel vp JOIN location_visits lv ON lv.id=vp.visit_id WHERE vp.personnel_id=t.personnel_id AND lv.location_id=t.location_id AND COALESCE(vp.checked_out_at,lv.check_out_at) IS NULL ORDER BY vp.checked_in_at DESC LIMIT 1;
 SELECT COALESCE(pl.timezone,to_jsonb(p)->>'timezone','America/Chicago') INTO z FROM project_locations pl JOIN projects p ON p.id=pl.project_id WHERE pl.id=t.location_id;
 e:=COALESCE(s.scheduled_end_at,public._shift_end_for(t.location_id,COALESCE(s.checked_in_at,s.visit_in,now())));u:=to_timestamp(floor(extract(epoch FROM p_until)/900)*900);
 IF u<=now() OR u>e+interval '6 hours' THEN RETURN jsonb_build_object('ok',false,'reason','bad_until');END IF;
 d:=(COALESCE(s.scheduled_start_at,s.checked_in_at,s.visit_in,now()) AT TIME ZONE z)::date;
 INSERT INTO shift_extensions(personnel_id,location_id,ext_date,reason,until_at) VALUES(t.personnel_id,t.location_id,d,left(trim(p_reason),200),u) ON CONFLICT(personnel_id,location_id,ext_date) DO UPDATE SET reason=EXCLUDED.reason,until_at=EXCLUDED.until_at,status='pending',requested_at=now(),decided_by=NULL,decided_at=NULL;
 RETURN jsonb_build_object('ok',true,'until',u,'status','pending');
END $$;