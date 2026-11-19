-- Run ONLY in an isolated schema copy; never against production.
-- The proposal must already be installed in that isolated database.
BEGIN;
SET LOCAL test.admin='true';
SET LOCAL test.uid='00000000-0000-0000-0000-000000000099';
INSERT INTO auth.users(id,email) VALUES('00000000-0000-0000-0000-000000000099','fixture@example.invalid');
DO $test$
DECLARE
  s uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); d uuid:=gen_random_uuid();
  entry uuid:=gen_random_uuid(); assignment uuid:=gen_random_uuid(); token_id uuid:=gen_random_uuid();
  v jsonb; choices jsonb; before_rows jsonb; after_rows jsonb; tab text; x uuid;
BEGIN
  INSERT INTO personnel(id,personnel_number,first_name,last_name,email,phone,status,onboarding_status,address,city,ssn_full,ssn_last_four,bank_account_number,everify_case_number)
    VALUES(s,'TEST-S','Source','Fixture','source@example.invalid','5550000001','active','completed','Source address','Source city','123456789','6789','123456789012','CASE-FIXTURE'),
          (t,'TEST-T','Target','Fixture','target@example.invalid','5550000002','active','pending',NULL,'Target city',NULL,NULL,NULL,NULL);
  INSERT INTO time_entries(id,personnel_id,hours) VALUES(entry,t,8);
  INSERT INTO personnel_project_assignments(id,personnel_id) VALUES(assignment,t);
  INSERT INTO site_checkin_tokens(id,personnel_id) VALUES(token_id,t);
  INSERT INTO personnel_documents(id,personnel_id,file_path) VALUES(d,s,'private/unchanged.pdf');
  INSERT INTO personnel_w9_forms(personnel_id) VALUES(s);
  INSERT INTO document_signatures(personnel_id,document_id,status) VALUES(s,gen_random_uuid(),'signed');
  INSERT INTO emergency_contacts(personnel_id,contact_name) VALUES(s,'Contact fixture');
  v:=preview_move_onboarding(s,t);
  IF NOT (v->>'eligible')::boolean THEN RAISE EXCEPTION 'Eligible pair rejected'; END IF;
  IF v::text LIKE '%123456789%' OR v::text LIKE '%123456789012%' THEN RAISE EXCEPTION 'Unmasked identity number'; END IF;
  SELECT jsonb_object_agg(value->>'field','target') INTO choices FROM jsonb_array_elements(v->'fields') WHERE value->>'action'='conflict';
  choices:=coalesce(choices,'{}')||'{"city":"source"}';
  BEGIN
    PERFORM move_onboarding_to_personnel(s,t,'{}');
    RAISE EXCEPTION 'MISSING_CONFLICT_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='MISSING_CONFLICT_WAS_ACCEPTED' THEN RAISE; END IF;
  END;
  IF (SELECT personnel_id FROM personnel_documents WHERE id=d)<>s OR (SELECT merged_into_id FROM personnel WHERE id=s) IS NOT NULL THEN RAISE EXCEPTION 'Missing choice did not rollback'; END IF;
  FOREACH tab IN ARRAY ARRAY['time_entries','location_attendance','personnel_project_assignments','location_assignments','site_checkin_tokens','visit_personnel','timesheet_signature_requests','personnel_payments','personnel_expenses','reimbursements','project_labor_expenses','shift_extensions','variance_resolutions','personnel_hotel_assignments','crew_members','punch_link_events'] LOOP
    x:=gen_random_uuid();
    EXECUTE format('INSERT INTO %I(id,personnel_id) VALUES($1,$2)',tab) USING x,s;
    IF (preview_move_onboarding(s,t)->>'eligible')::boolean THEN RAISE EXCEPTION 'Source history accepted: %',tab; END IF;
    BEGIN
      PERFORM move_onboarding_to_personnel(s,t,choices);
      RAISE EXCEPTION 'INELIGIBLE_ACCEPTED';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM='INELIGIBLE_ACCEPTED' THEN RAISE; END IF; END;
    EXECUTE format('DELETE FROM %I WHERE id=$1',tab) USING x;
  END LOOP;
  UPDATE personnel SET onboarding_status='completed' WHERE id=t;
  IF (preview_move_onboarding(s,t)->>'eligible')::boolean THEN RAISE EXCEPTION 'Both onboarded accepted'; END IF;
  UPDATE personnel SET onboarding_status='pending',user_id=gen_random_uuid() WHERE id=t;
  UPDATE personnel SET user_id=gen_random_uuid() WHERE id=s;
  IF (preview_move_onboarding(s,t)->>'eligible')::boolean THEN RAISE EXCEPTION 'Both logins accepted'; END IF;
  UPDATE personnel SET user_id=NULL WHERE id=t;
  PERFORM set_config('test.admin','false',true);
  BEGIN PERFORM preview_move_onboarding(s,t); RAISE EXCEPTION 'NON_ADMIN_ACCEPTED';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM move_onboarding_to_personnel(s,t,choices); RAISE EXCEPTION 'NON_ADMIN_ACCEPTED';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('test.admin','true',true);
  before_rows:=jsonb_build_object('entry',(SELECT to_jsonb(a) FROM time_entries a WHERE id=entry),'assignment',(SELECT to_jsonb(a) FROM personnel_project_assignments a WHERE id=assignment),'token',(SELECT to_jsonb(a) FROM site_checkin_tokens a WHERE id=token_id));
  v:=move_onboarding_to_personnel(s,t,choices);
  after_rows:=jsonb_build_object('entry',(SELECT to_jsonb(a) FROM time_entries a WHERE id=entry),'assignment',(SELECT to_jsonb(a) FROM personnel_project_assignments a WHERE id=assignment),'token',(SELECT to_jsonb(a) FROM site_checkin_tokens a WHERE id=token_id));
  IF before_rows IS DISTINCT FROM after_rows THEN RAISE EXCEPTION 'Operational history changed'; END IF;
  IF (SELECT personnel_id FROM personnel_documents WHERE id=d)<>t OR (SELECT file_path FROM personnel_documents WHERE id=d)<>'private/unchanged.pdf' THEN RAISE EXCEPTION 'Document move failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM personnel_w9_forms WHERE personnel_id=t) OR NOT EXISTS(SELECT 1 FROM document_signatures WHERE personnel_id=t) OR NOT EXISTS(SELECT 1 FROM emergency_contacts WHERE personnel_id=t) THEN RAISE EXCEPTION 'Evidence not moved'; END IF;
  IF NOT EXISTS(SELECT 1 FROM personnel WHERE id=t AND address='Source address' AND city='Source city' AND everify_case_number='CASE-FIXTURE' AND first_name='Target' AND personnel_number='TEST-T' AND user_id IS NOT NULL) THEN RAISE EXCEPTION 'Field or portal move failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM personnel WHERE id=s AND status='inactive' AND merged_into_id=t AND user_id IS NULL) THEN RAISE EXCEPTION 'Source disposition failed'; END IF;
  IF EXISTS(SELECT 1 FROM audit_logs WHERE metadata::text LIKE '%123456789%' OR metadata::text LIKE '%Source city%') THEN RAISE EXCEPTION 'Audit leaked values'; END IF;
  RAISE NOTICE 'PASS: eligible move, 16 history guards, conflicts/rollback, masking, both-completed/logins, admin denial, operational preservation, portal and evidence move';
END $test$;
DO $test$
DECLARE
  s uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); doc uuid:=gen_random_uuid();
  project uuid:=gen_random_uuid(); v jsonb; choices jsonb; tab text;
BEGIN
  INSERT INTO personnel(id,personnel_number,status,onboarding_status) VALUES(s,'SKIP-S','active','completed'),(t,'SKIP-T','active',NULL);
  INSERT INTO time_entries(personnel_id,hours) VALUES(t,1);
  INSERT INTO personnel_w9_forms(personnel_id) VALUES(s),(t);
  INSERT INTO document_signatures(personnel_id,document_id) VALUES(s,doc),(t,doc);
  INSERT INTO personnel_badges(personnel_id,active) VALUES(s,true),(t,true);
  INSERT INTO personnel_capabilities(personnel_id,capability) VALUES(s,'Fixture'),(t,'fixture');
  INSERT INTO personnel_engagement_notes(personnel_id,project_id) VALUES(s,project),(t,project);
  v:=preview_move_onboarding(s,t);
  SELECT coalesce(jsonb_object_agg(value->>'field','target'),'{}') INTO choices FROM jsonb_array_elements(v->'fields') WHERE value->>'action'='conflict';
  v:=move_onboarding_to_personnel(s,t,choices);
  FOREACH tab IN ARRAY ARRAY['personnel_w9_forms','document_signatures','personnel_badges','personnel_capabilities','personnel_engagement_notes'] LOOP
    IF (v->'tables'->tab->>'skipped')::int<>1 OR (v->'tables'->tab->>'moved')::int<>0 THEN RAISE EXCEPTION 'Collision count incorrect: %',tab; END IF;
  END LOOP;
  IF (SELECT count(*) FROM document_signatures WHERE personnel_id IN(s,t) AND document_id=doc)<>2 THEN RAISE EXCEPTION 'Skipped evidence deleted'; END IF;
  RAISE NOTICE 'PASS: all five live unique collision rules retain target and skipped source evidence';
END $test$;
ROLLBACK;