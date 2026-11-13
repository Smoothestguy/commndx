-- Execute against an isolated database with the current public functions installed.
-- Every fixture and function side effect is rolled back, including notifications.
BEGIN;
SET LOCAL request.jwt.claim.role = 'service_role';
DO $test$
DECLARE
 pr uuid:=gen_random_uuid(); lo uuid:=gen_random_uuid(); pe uuid:=gen_random_uuid();
 vi uuid:=gen_random_uuid(); st uuid:=gen_random_uuid(); tok uuid:=gen_random_uuid();
 future_st uuid; locked_st uuid; manual_st uuid; old_st uuid; extension_st uuid;
 start_at timestamptz:=date_trunc('hour',now())-interval '14 hours';
 end_at timestamptz:=date_trunc('hour',now())-interval '2 hours';
 correction timestamptz; ex uuid; r jsonb; count_before integer;
BEGIN
 INSERT INTO projects(id,name,start_date,timezone,checkout_rounding_minutes)
 VALUES(pr,'__autoclose_rollback_test',(start_at AT TIME ZONE 'America/New_York')::date,'America/New_York',15);
 INSERT INTO project_locations(id,project_id,name,status,timezone)
 VALUES(lo,pr,'__autoclose_rollback_test','active','America/New_York');
 INSERT INTO personnel(id,personnel_number,first_name,last_name,email)
 VALUES(pe,'TEST-'||pe::text,'AutoClose','Rollback',pe::text||'@example.invalid');
 INSERT INTO location_visits(id,location_id,check_in_at) VALUES(vi,lo,start_at);
 INSERT INTO visit_personnel(id,visit_id,personnel_id,checked_in_at,actual_in_at,scheduled_start_at,scheduled_end_at)
 VALUES(st,vi,pe,start_at,start_at-interval '10 minutes',start_at,end_at);
 INSERT INTO site_checkin_tokens(id,personnel_id,location_id,expires_at) VALUES(tok,pe,lo,now()+interval '1 hour');
 SELECT count(*) INTO count_before FROM audit_logs;
 r:=public.scheduled_close_punches(now(),true,lo);
 IF jsonb_array_length(r->'entries')<>1 OR (r->'entries'->0->>'end_at')::timestamptz<>end_at THEN RAISE EXCEPTION 'dry-run exact frozen boundary failed: %',r; END IF;
 IF EXISTS(SELECT 1 FROM visit_personnel WHERE id=st AND checked_out_at IS NOT NULL) OR (SELECT count(*) FROM audit_logs)<>count_before THEN RAISE EXCEPTION 'dry-run mutated evidence'; END IF;
 r:=public.scheduled_close_punches(now(),false,lo);
 IF NOT EXISTS(SELECT 1 FROM visit_personnel WHERE id=st AND checked_out_at=end_at AND actual_out_at IS NULL AND actual_in_at=start_at-interval '10 minutes' AND auto_closed_at IS NOT NULL AND auto_close_reason='forgot to clock out') THEN RAISE EXCEPTION 'auto-close evidence or exact schedule failed: %',r; END IF;
 IF NOT EXISTS(SELECT 1 FROM time_entries WHERE visit_personnel_id=st AND hours=12 AND clock_out_at=end_at) THEN RAISE EXCEPTION 'canonical 12-hour ledger failed'; END IF;
 r:=public.scheduled_close_punches(now(),false,lo);
 IF jsonb_array_length(r->'entries')<>0 THEN RAISE EXCEPTION 'auto-close is not idempotent'; END IF;
 correction:=end_at+interval '75 minutes';
 r:=public.request_closed_shift_extension(tok,'Worked later',correction);
 IF r->>'ok'<>'true' OR NOT EXISTS(SELECT 1 FROM visit_personnel WHERE id=st AND reported_out_at=correction AND checked_out_at=end_at AND actual_out_at IS NULL) THEN RAISE EXCEPTION 'correction invented a punch or counted unapproved time: %',r; END IF;
 SELECT id INTO ex FROM shift_extensions WHERE personnel_id=pe AND location_id=lo;
 UPDATE shift_extensions SET status='approved' WHERE id=ex;
 IF NOT EXISTS(SELECT 1 FROM time_entries WHERE visit_personnel_id=st AND hours=13.25) OR NOT EXISTS(SELECT 1 FROM visit_personnel WHERE id=st AND checked_out_at=correction AND actual_out_at IS NULL) THEN RAISE EXCEPTION 'approval recount or blank actual failed'; END IF;
 UPDATE shift_extensions SET status='denied' WHERE id=ex;
 IF NOT EXISTS(SELECT 1 FROM time_entries WHERE visit_personnel_id=st AND hours=12) THEN RAISE EXCEPTION 'denial did not restore schedule'; END IF;
 FOR count_before IN 1..5 LOOP
  pe:=gen_random_uuid();vi:=gen_random_uuid();
  INSERT INTO personnel(id,personnel_number,first_name,last_name,email) VALUES(pe,'TEST-'||pe::text,'Guard','Rollback',pe::text||'@example.invalid');
  INSERT INTO location_visits(id,location_id,check_in_at) VALUES(vi,lo,CASE WHEN count_before=4 THEN now()-interval '72 hours' ELSE start_at END);
  INSERT INTO visit_personnel(visit_id,personnel_id,checked_in_at,scheduled_start_at,scheduled_end_at,manual_time_override)
  VALUES(vi,pe,CASE WHEN count_before=4 THEN now()-interval '72 hours' ELSE start_at END,start_at,CASE WHEN count_before=1 THEN now()+interval '1 hour' ELSE end_at END,count_before=3) RETURNING id INTO st;
  IF count_before=1 THEN future_st:=st;
  ELSIF count_before=2 THEN
   locked_st:=st;
   INSERT INTO time_entries(personnel_id,project_id,location_id,visit_personnel_id,entry_date,hours,is_locked) VALUES(pe,pr,lo,st,(start_at AT TIME ZONE 'America/New_York')::date,0,true);
  ELSIF count_before=3 THEN manual_st:=st;
  ELSIF count_before=4 THEN old_st:=st;
  ELSE
   extension_st:=st;
   INSERT INTO shift_extensions(personnel_id,location_id,ext_date,reason,until_at,status) VALUES(pe,lo,(start_at AT TIME ZONE 'America/New_York')::date,'Approved extra time',now()+interval '1 hour','approved');
  END IF;
 END LOOP;
 r:=public.scheduled_close_punches(now(),false,lo);
 IF EXISTS(SELECT 1 FROM visit_personnel WHERE id=ANY(ARRAY[future_st,locked_st,manual_st,old_st,extension_st]) AND checked_out_at IS NOT NULL) THEN RAISE EXCEPTION 'future/locked/manual/history/approved extension guard failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'entries') e WHERE (e->>'stay_id')::uuid=locked_st AND (e->>'blocked')::boolean) THEN RAISE EXCEPTION 'locked row was not reported blocked'; END IF;
 r:=public.scheduled_close_punches(now()+interval '61 minutes',true,lo);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'entries') e WHERE (e->>'stay_id')::uuid=extension_st) THEN RAISE EXCEPTION 'approved extension end never becomes due'; END IF;
 r:=public.record_punch_link_open(gen_random_uuid(),gen_random_uuid(),28.1,-81.8,5);
 IF r<>jsonb_build_object('ok',false) THEN RAISE EXCEPTION 'invalid token accepted'; END IF;
 -- Separate token owner has no punch: the open event must still be retained.
 pe:=gen_random_uuid();
 INSERT INTO personnel(id,personnel_number,first_name,last_name,email) VALUES(pe,'TEST-'||pe::text,'NoPunch','Rollback',pe::text||'@example.invalid');
 INSERT INTO site_checkin_tokens(personnel_id,location_id,expires_at) VALUES(pe,lo,now()+interval '1 hour') RETURNING id INTO tok;
 r:=public.record_punch_link_open(tok,gen_random_uuid(),28.1,-81.8,5);
 IF NOT EXISTS(SELECT 1 FROM punch_link_events WHERE personnel_id=pe AND location_id=lo AND visit_personnel_id IS NULL AND gps_status='captured' AND lat=28.1 AND lng=-81.8) THEN RAISE EXCEPTION 'GPS open without punch lost'; END IF;
 UPDATE punch_link_events SET opened_at=now()-interval '11 seconds' WHERE personnel_id=pe;
 r:=public.record_punch_link_open(tok,gen_random_uuid());
 IF NOT EXISTS(SELECT 1 FROM punch_link_events WHERE personnel_id=pe AND gps_status='unavailable' AND lat IS NULL AND lng IS NULL) THEN RAISE EXCEPTION 'denied GPS open lost'; END IF;
 IF has_function_privilege('anon','public.scheduled_close_punches(timestamptz,boolean,uuid)','execute') OR has_function_privilege('authenticated','public.scheduled_close_punches(timestamptz,boolean,uuid)','execute') THEN RAISE EXCEPTION 'auto-close caller exposed'; END IF;
 RAISE NOTICE 'PASS: frozen schedule, blank actual, ledger, approval/denial, dry-run, idempotency, guards, token GPS and privileges';
END $test$;
ROLLBACK;