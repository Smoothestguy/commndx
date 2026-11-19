-- Owner-approved corrected SQL: one migration adding exactly two functions.
-- No existing function, trigger, policy, table, column, cron or storage change.
-- Collision skips retain the source evidence row; no evidence is deleted.
-- Existing personnel_status_log accepts 'unavailable', NOT 'inactive'.
-- Therefore the source personnel.status becomes inactive and its log uses unavailable.
-- Preview never returns bearer links, private file paths, signatures, full TINs,
-- routing numbers, encrypted blobs, or bank account numbers.

CREATE FUNCTION public.preview_move_onboarding(p_source uuid, p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  s public.personnel%ROWTYPE;
  t public.personnel%ROWTYPE;
  sj jsonb; tj jsonb;
  reasons jsonb := '[]'; fields jsonb := '[]'; counts jsonb := '{}';
  source_history jsonb := '{}'; target_history jsonb := '{}';
  f text; tab text; mode text; action text; note text;
  sv jsonb; tv jsonb; display_s jsonb; display_t jsonb;
  n bigint; tn bigint; skips bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  -- Fail closed on schema drift: every referenced personnel field must exist.
  FOREACH f IN ARRAY ARRAY['first_name','last_name','email','phone','date_of_birth','address','city','state','zip','photo_url','ssn_last_four','ssn_full','itin','citizenship_status','immigration_status','work_authorization_status','work_authorization_type','work_auth_expiry','id_document_url','i9_completed_at','everify_status','everify_case_number','everify_verified_at','everify_expiry','bank_name','bank_account_type','bank_routing_number','bank_account_number','direct_deposit_signed_at','direct_deposit_signature','tax_classification','tax_ein','tax_business_name','w9_signed_at','w9_signature','w9_certification','ica_signed_at','ica_signature','gender','sms_consent_at','sms_consent_version','photo_consent_at','photo_consent_version','background_consent_at','background_consent_version','email_verified_at','email_verified_source','phone_verified_at','phone_verified_source','hourly_rate','pay_rate','bill_rate','rating','vendor_id','linked_vendor_id','employer_customer_id','status','portal_required','non_billable','notes','onboarding_status','onboarding_completed_at','home_lat','home_lng','geocoded_at','geocode_source','is_geocodable','banking_info_updated_at','banking_info_updated_by','bank_account_number_encrypted','bank_routing_number_encrypted','bank_account_last4','merged_at','merged_by','merge_reason','user_id','id','personnel_number','deleted_at','merged_into_id']::text[] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.personnel'::regclass AND attname=f AND attnum>0 AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Required personnel column missing: %',f;
    END IF;
  END LOOP;
  SELECT * INTO s FROM public.personnel WHERE id=p_source;
  IF NOT FOUND THEN reasons:=reasons || jsonb_build_array('Source not found'); END IF;
  SELECT * INTO t FROM public.personnel WHERE id=p_target;
  IF NOT FOUND THEN reasons:=reasons || jsonb_build_array('Target not found'); END IF;
  IF s.id IS NULL OR t.id IS NULL THEN
    RETURN jsonb_build_object('eligible',false,'reasons',reasons,'fields',fields,'counts',counts);
  END IF;
  IF s.id=t.id THEN reasons:=reasons || jsonb_build_array('Source and target must differ'); END IF;
  IF s.merged_into_id IS NOT NULL OR t.merged_into_id IS NOT NULL THEN
    reasons:=reasons || jsonb_build_array('A record already has merged_into_id');
  END IF;
  IF s.deleted_at IS NOT NULL OR t.deleted_at IS NOT NULL THEN
    reasons:=reasons || jsonb_build_array('A record is deleted');
  END IF;
  IF NOT (coalesce(s.onboarding_status='completed',false) OR s.onboarding_completed_at IS NOT NULL) THEN
    reasons:=reasons || jsonb_build_array('Source onboarding is not completed');
  END IF;
  IF coalesce(t.onboarding_status='completed',false) OR t.onboarding_completed_at IS NOT NULL THEN
    reasons:=reasons || jsonb_build_array('Target onboarding is already completed');
  END IF;
  IF s.user_id IS NOT NULL AND t.user_id IS NOT NULL THEN
    reasons:=reasons || jsonb_build_array('Both records have portal logins');
  END IF;
  FOREACH tab IN ARRAY ARRAY['time_entries','location_attendance','personnel_project_assignments','location_assignments','site_checkin_tokens','visit_personnel','timesheet_signature_requests','personnel_payments','personnel_expenses','reimbursements','project_labor_expenses','shift_extensions','variance_resolutions','personnel_hotel_assignments','crew_members','punch_link_events']::text[] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE personnel_id=$1',tab) INTO n USING s.id;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE personnel_id=$1',tab) INTO tn USING t.id;
    source_history:=source_history || jsonb_build_object(tab,n);
    target_history:=target_history || jsonb_build_object(tab,tn);
    IF n>0 THEN reasons:=reasons || jsonb_build_array('Source has '||n||' row(s) in '||tab); END IF;
  END LOOP;
  -- A history-free target is not the owner-approved use case.
  IF (target_history->>'time_entries')::bigint=0 AND
     (target_history->>'location_attendance')::bigint=0 AND
     (target_history->>'visit_personnel')::bigint=0 THEN
    reasons:=reasons || jsonb_build_array('Target has no work history');
  END IF;
  FOREACH tab IN ARRAY ARRAY['personnel_documents','personnel_w9_forms','document_signatures','emergency_contacts','personnel_certifications','personnel_badges','personnel_languages','personnel_capabilities','personnel_engagement_notes','personnel_onboarding_tokens','personnel_registrations','onboarding_email_deliveries']::text[] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE personnel_id=$1',tab) INTO n USING s.id;
    skips:=0;
    CASE tab
      WHEN 'personnel_w9_forms' THEN
        SELECT count(*) INTO skips FROM public.personnel_w9_forms a
        WHERE a.personnel_id=s.id AND EXISTS(SELECT 1 FROM public.personnel_w9_forms b WHERE b.personnel_id=t.id);
      WHEN 'document_signatures' THEN
        SELECT count(*) INTO skips FROM public.document_signatures a WHERE a.personnel_id=s.id AND EXISTS
          (SELECT 1 FROM public.document_signatures b WHERE b.personnel_id=t.id AND b.document_id=a.document_id);
      WHEN 'personnel_badges' THEN
        SELECT count(*) INTO skips FROM public.personnel_badges a WHERE a.personnel_id=s.id AND a.active AND EXISTS
          (SELECT 1 FROM public.personnel_badges b WHERE b.personnel_id=t.id AND b.active);
      WHEN 'personnel_capabilities' THEN
        SELECT count(*) INTO skips FROM public.personnel_capabilities a WHERE a.personnel_id=s.id AND EXISTS
          (SELECT 1 FROM public.personnel_capabilities b WHERE b.personnel_id=t.id AND lower(b.capability)=lower(a.capability));
      WHEN 'personnel_engagement_notes' THEN
        SELECT count(*) INTO skips FROM public.personnel_engagement_notes a WHERE a.personnel_id=s.id AND EXISTS
          (SELECT 1 FROM public.personnel_engagement_notes b WHERE b.personnel_id=t.id AND b.project_id=a.project_id
           AND coalesce(b.location_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(a.location_id,'00000000-0000-0000-0000-000000000000'::uuid));
      ELSE NULL;
    END CASE;
    counts:=counts || jsonb_build_object(tab,jsonb_build_object('source',n,'move',n-skips,'skip',skips));
  END LOOP;
  sj:=to_jsonb(s); tj:=to_jsonb(t);
  FOREACH f IN ARRAY ARRAY['first_name','last_name','email','phone','date_of_birth','address','city','state','zip','photo_url','ssn_last_four','ssn_full','itin','citizenship_status','immigration_status','work_authorization_status','work_authorization_type','work_auth_expiry','id_document_url','i9_completed_at','everify_status','everify_case_number','everify_verified_at','everify_expiry','bank_name','bank_account_type','bank_routing_number','bank_account_number','direct_deposit_signed_at','direct_deposit_signature','tax_classification','tax_ein','tax_business_name','w9_signed_at','w9_signature','w9_certification','ica_signed_at','ica_signature','gender','sms_consent_at','sms_consent_version','photo_consent_at','photo_consent_version','background_consent_at','background_consent_version','email_verified_at','email_verified_source','phone_verified_at','phone_verified_source','hourly_rate','pay_rate','bill_rate','rating','vendor_id','linked_vendor_id','employer_customer_id','status','portal_required','non_billable','notes']::text[] LOOP
    mode:=CASE WHEN f=ANY(ARRAY['first_name','last_name','email','phone']::text[]) THEN 'contact' WHEN f=ANY(ARRAY['hourly_rate','pay_rate','bill_rate','rating','vendor_id','linked_vendor_id','employer_customer_id','status','portal_required','non_billable','notes']::text[]) THEN 'employment' ELSE 'profile' END;
    sv:=sj->f; tv:=tj->f; note:=NULL;
    -- Treat encrypted and plaintext bank representations as one logical field.
    -- Ciphertext equality is deliberately not used: encryption is randomized.
    IF f IN ('bank_account_number','bank_routing_number') THEN
      SELECT to_jsonb(CASE WHEN f='bank_account_number' THEN b.bank_account_number ELSE b.bank_routing_number END)
        INTO sv FROM public.admin_get_personnel_banking(s.id) b;
      SELECT to_jsonb(CASE WHEN f='bank_account_number' THEN b.bank_account_number ELSE b.bank_routing_number END)
        INTO tv FROM public.admin_get_personnel_banking(t.id) b;
    END IF;
    action:=CASE
      WHEN sv IS NULL OR sv='null'::jsonb OR sv='""'::jsonb THEN 'keep'
      WHEN mode='contact' THEN 'keep'
      WHEN tv IS NULL OR tv='null'::jsonb OR tv='""'::jsonb THEN 'fill'
      WHEN mode='employment' OR sv=tv THEN 'keep'
      ELSE 'conflict' END;
    -- Never attach verification evidence to a different retained email/phone.
    IF f LIKE 'email_verified_%' AND public.normalize_email(s.email) IS DISTINCT FROM public.normalize_email(t.email) THEN
      action:='keep'; note:='Verification follows chosen email, never a different address';
    ELSIF f LIKE 'phone_verified_%' AND public.normalize_phone(s.phone) IS DISTINCT FROM public.normalize_phone(t.phone) THEN
      action:='keep'; note:='Verification follows chosen phone, never a different number';
    END IF;
    display_s:=sv; display_t:=tv;
    IF f IN ('ssn_full','ssn_last_four','itin','tax_ein','bank_account_number') THEN
      display_s:=CASE WHEN sv IS NULL OR sv='null'::jsonb OR sv='""'::jsonb THEN 'null'::jsonb ELSE to_jsonb('••••'||right(sv#>>'{}',4)) END;
      display_t:=CASE WHEN tv IS NULL OR tv='null'::jsonb OR tv='""'::jsonb THEN 'null'::jsonb ELSE to_jsonb('••••'||right(tv#>>'{}',4)) END;
    ELSIF f IN ('bank_routing_number','direct_deposit_signature','w9_signature','ica_signature','photo_url','id_document_url') THEN
      display_s:=CASE WHEN sv IS NULL OR sv='null'::jsonb OR sv='""'::jsonb THEN 'null'::jsonb ELSE '"Present"'::jsonb END;
      display_t:=CASE WHEN tv IS NULL OR tv='null'::jsonb OR tv='""'::jsonb THEN 'null'::jsonb ELSE '"Present"'::jsonb END;
    END IF;
    fields:=fields || jsonb_build_array(jsonb_build_object('field',f,'source',display_s,'target',display_t,'action',action,'mode',mode,'note',note));
  END LOOP;
  RETURN jsonb_build_object('eligible',jsonb_array_length(reasons)=0,'reasons',reasons,'fields',fields,'counts',counts,
    'source',jsonb_build_object('id',s.id,'personnel_number',s.personnel_number,'name',concat_ws(' ',s.first_name,s.last_name),'phone',s.phone,
      'ssn_last4',right(coalesce(nullif(s.ssn_last_four,''),s.ssn_full),4),'bank_last4',right(coalesce(nullif(s.bank_account_last4,''),s.bank_account_number),4)),
    'target',jsonb_build_object('id',t.id,'personnel_number',t.personnel_number,'name',concat_ws(' ',t.first_name,t.last_name),'phone',t.phone,
      'ssn_last4',right(coalesce(nullif(t.ssn_last_four,''),t.ssn_full),4),'bank_last4',right(coalesce(nullif(t.bank_account_last4,''),t.bank_account_number),4)),
    'source_history',source_history,'target_untouched',target_history,
    'portal_login_action',CASE WHEN s.user_id IS NOT NULL AND t.user_id IS NULL THEN 'move' ELSE 'keep' END);
END;
$function$;
REVOKE ALL ON FUNCTION public.preview_move_onboarding(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_move_onboarding(uuid,uuid) TO authenticated;

CREATE FUNCTION public.move_onboarding_to_personnel(p_source uuid,p_target uuid,p_choices jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET lock_timeout = '3s'
SET statement_timeout = '15s'
AS $function$
DECLARE
  s public.personnel%ROWTYPE; t public.personnel%ROWTYPE;
  preview jsonb; sj jsonb; patch jsonb:='{}'; item jsonb;
  f text; choice text; tab text; child record;
  moved bigint; skipped bigint; constraint_name text; constraint_table text;
  results jsonb:='{}'; filled jsonb:='[]'; chosen jsonb:='[]';
  actor_email text; assignments text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501';
  END IF;
  IF p_choices IS NULL OR jsonb_typeof(p_choices)<>'object' THEN
    RAISE EXCEPTION 'Choices must be an object';
  END IF;
  -- Only the two personnel rows are locked; operational tables are read-only.
  -- No lock is taken on the non-FK punch_link_events log; its concurrent-write
  -- race cannot be eliminated without changing the owner-approved scope.

  PERFORM id FROM public.personnel WHERE id IN(p_source,p_target) ORDER BY id FOR UPDATE;
  -- Fail closed on schema drift: every referenced personnel field must exist.
  FOREACH f IN ARRAY ARRAY['first_name','last_name','email','phone','date_of_birth','address','city','state','zip','photo_url','ssn_last_four','ssn_full','itin','citizenship_status','immigration_status','work_authorization_status','work_authorization_type','work_auth_expiry','id_document_url','i9_completed_at','everify_status','everify_case_number','everify_verified_at','everify_expiry','bank_name','bank_account_type','bank_routing_number','bank_account_number','direct_deposit_signed_at','direct_deposit_signature','tax_classification','tax_ein','tax_business_name','w9_signed_at','w9_signature','w9_certification','ica_signed_at','ica_signature','gender','sms_consent_at','sms_consent_version','photo_consent_at','photo_consent_version','background_consent_at','background_consent_version','email_verified_at','email_verified_source','phone_verified_at','phone_verified_source','hourly_rate','pay_rate','bill_rate','rating','vendor_id','linked_vendor_id','employer_customer_id','status','portal_required','non_billable','notes','onboarding_status','onboarding_completed_at','home_lat','home_lng','geocoded_at','geocode_source','is_geocodable','banking_info_updated_at','banking_info_updated_by','bank_account_number_encrypted','bank_routing_number_encrypted','bank_account_last4','merged_at','merged_by','merge_reason','user_id','id','personnel_number','deleted_at','merged_into_id']::text[] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.personnel'::regclass AND attname=f AND attnum>0 AND NOT attisdropped) THEN
      RAISE EXCEPTION 'Required personnel column missing: %',f;
    END IF;
  END LOOP;
  SELECT * INTO s FROM public.personnel WHERE id=p_source;
  SELECT * INTO t FROM public.personnel WHERE id=p_target;
  preview:=public.preview_move_onboarding(p_source,p_target);
  IF NOT coalesce((preview->>'eligible')::boolean,false) THEN
    RAISE EXCEPTION 'Move onboarding is not eligible: %',preview->'reasons';
  END IF;
  sj:=to_jsonb(s);
  FOR f,choice IN SELECT key,value FROM jsonb_each_text(p_choices) LOOP
    IF NOT f=ANY(ARRAY['first_name','last_name','email','phone','date_of_birth','address','city','state','zip','photo_url','ssn_last_four','ssn_full','itin','citizenship_status','immigration_status','work_authorization_status','work_authorization_type','work_auth_expiry','id_document_url','i9_completed_at','everify_status','everify_case_number','everify_verified_at','everify_expiry','bank_name','bank_account_type','bank_routing_number','bank_account_number','direct_deposit_signed_at','direct_deposit_signature','tax_classification','tax_ein','tax_business_name','w9_signed_at','w9_signature','w9_certification','ica_signed_at','ica_signature','gender','sms_consent_at','sms_consent_version','photo_consent_at','photo_consent_version','background_consent_at','background_consent_version','email_verified_at','email_verified_source','phone_verified_at','phone_verified_source','hourly_rate','pay_rate','bill_rate','rating','vendor_id','linked_vendor_id','employer_customer_id','status','portal_required','non_billable','notes']::text[]) OR choice IS NULL OR choice NOT IN('source','target') OR jsonb_typeof(p_choices->f)<>'string' THEN
      RAISE EXCEPTION 'Invalid field choice: %',f;
    END IF;
    IF f=ANY(ARRAY['hourly_rate','pay_rate','bill_rate','rating','vendor_id','linked_vendor_id','employer_customer_id','status','portal_required','non_billable','notes']::text[]) AND choice='source' THEN
      RAISE EXCEPTION 'Employment fields cannot be overwritten: %',f;
    END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(preview->'fields') LOOP
    f:=item->>'field'; choice:=p_choices->>f;
    IF item->>'action'='conflict' AND choice IS NULL THEN
      RAISE EXCEPTION 'Choose source or target for conflict: %',f;
    END IF;
    IF (item->>'action'='fill' AND coalesce(choice,'source')='source') OR
       (item->>'action'='conflict' AND choice='source') OR
       (item->>'mode'='contact' AND choice='source') THEN
      patch:=patch || jsonb_build_object(f,sj->f);
      IF item->>'action'='fill' THEN filled:=filled || to_jsonb(f);
      ELSE chosen:=chosen || to_jsonb(f); END IF;
      IF f='bank_account_number' THEN
        patch:=patch || jsonb_build_object('bank_account_number_encrypted',sj->'bank_account_number_encrypted',
          'bank_account_last4',sj->'bank_account_last4');
      ELSIF f='bank_routing_number' THEN
        patch:=patch || jsonb_build_object('bank_routing_number_encrypted',sj->'bank_routing_number_encrypted');
      END IF;
    ELSIF choice='target' THEN chosen:=chosen || to_jsonb(f); END IF;
  END LOOP;
  -- Verification is contact-bound. Changing contact uses only matching source
  -- stamps, including NULL to clear a stamp belonging to the prior contact.
  FOREACH f IN ARRAY ARRAY['email','phone'] LOOP
    IF patch ? f AND (patch->f) IS DISTINCT FROM (to_jsonb(t)->f) THEN
      patch:=patch || jsonb_build_object(f||'_verified_at',sj->(f||'_verified_at'),f||'_verified_source',sj->(f||'_verified_source'));
      chosen:=chosen || jsonb_build_array(f||'_verified_at',f||'_verified_source');
    END IF;
  END LOOP;
  -- Full SSN and last-four must never describe different identities.
  IF patch ? 'ssn_full' AND nullif(patch->>'ssn_full','') IS NOT NULL THEN
    IF patch ? 'ssn_last_four' AND (patch->>'ssn_last_four') IS DISTINCT FROM right(patch->>'ssn_full',4) THEN
      RAISE EXCEPTION 'SSN field choices are inconsistent';
    END IF;
    IF NOT patch ? 'ssn_last_four' AND nullif(t.ssn_last_four,'') IS NOT NULL AND t.ssn_last_four<>right(patch->>'ssn_full',4) THEN
      RAISE EXCEPTION 'Choose matching SSN last-four';
    END IF;
    patch:=patch || jsonb_build_object('ssn_last_four',right(patch->>'ssn_full',4));
  ELSIF patch ? 'ssn_last_four' AND nullif(t.ssn_full,'') IS NOT NULL AND patch->>'ssn_last_four'<>right(t.ssn_full,4) THEN
    RAISE EXCEPTION 'Choose matching SSN fields';
  END IF;
  -- Completion comes from the eligible source, never a conflict choice.
  patch:=patch || jsonb_build_object('onboarding_status',s.onboarding_status,'onboarding_completed_at',s.onboarding_completed_at);
  IF patch ? 'address' THEN
    patch:=patch || jsonb_build_object('home_lat',s.home_lat,'home_lng',s.home_lng,'geocoded_at',s.geocoded_at,'geocode_source',s.geocode_source,'is_geocodable',s.is_geocodable);
  END IF;
  IF patch ? 'bank_name' OR patch ? 'bank_account_type' OR patch ? 'bank_routing_number' OR patch ? 'bank_account_number' THEN
    patch:=patch || jsonb_build_object('banking_info_updated_at',s.banking_info_updated_at,'banking_info_updated_by',s.banking_info_updated_by);
  END IF;
  -- Move portal association only after clearing its unique source value.
  IF s.user_id IS NOT NULL AND t.user_id IS NULL THEN
    UPDATE public.personnel SET user_id=NULL WHERE id=s.id;
    patch:=patch || jsonb_build_object('user_id',s.user_id);
    chosen:=chosen || jsonb_build_array('user_id');
  END IF;
  -- Only allow-listed fields assembled above become identifiers. One target
  -- UPDATE fires existing triggers normally; never disable or replace triggers.
  SELECT string_agg(format('%I=r.%I',key,key),', ' ORDER BY key) INTO assignments FROM jsonb_object_keys(patch) key;
  IF assignments IS NOT NULL THEN
    EXECUTE format('UPDATE public.personnel p SET %s FROM jsonb_populate_record(NULL::public.personnel,$1) r WHERE p.id=$2',assignments)
      USING patch,t.id;
  END IF;
  FOREACH tab IN ARRAY ARRAY['personnel_documents','personnel_w9_forms','document_signatures','emergency_contacts','personnel_certifications','personnel_badges','personnel_languages','personnel_capabilities','personnel_engagement_notes','personnel_onboarding_tokens','personnel_registrations','onboarding_email_deliveries']::text[] LOOP
    moved:=0; skipped:=0;
    FOR child IN EXECUTE format('SELECT id FROM public.%I WHERE personnel_id=$1 ORDER BY id',tab) USING s.id LOOP
      BEGIN
        EXECUTE format('UPDATE public.%I SET personnel_id=$1 WHERE id=$2 AND personnel_id=$3',tab) USING t.id,child.id,s.id;
        moved:=moved+1;
      EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS constraint_name=CONSTRAINT_NAME, constraint_table=TABLE_NAME;
        -- Only confirmed personnel-dependent unique collisions are skippable;
        -- unrelated trigger/uniqueness failures abort the entire transaction.
        IF constraint_table<>tab OR constraint_name<>ALL(ARRAY[
          'personnel_w9_forms_personnel_id_key','document_signatures_document_id_personnel_id_key',
          'personnel_badges_active_uniq','personnel_capabilities_person_label_uidx','personnel_engagement_notes_uidx']) THEN
          RAISE;
        END IF;
        skipped:=skipped+1;
      END;
    END LOOP;
    results:=results || jsonb_build_object(tab,jsonb_build_object('moved',moved,'skipped',skipped));
  END LOOP;
  UPDATE public.personnel SET status='inactive',merged_into_id=t.id,merged_at=now(),merged_by=auth.uid(),merge_reason='Onboarding moved to '||t.personnel_number WHERE id=s.id;
  -- Include derived encryption/last-four/verification FIELD NAMES, never values.
  SELECT coalesce(jsonb_agg(key ORDER BY key),'[]'::jsonb) INTO chosen
    FROM jsonb_object_keys(patch) key WHERE NOT filled ? key;
  INSERT INTO public.personnel_status_log(personnel_id,status,note,set_by)
    VALUES(s.id,'unavailable','Onboarding moved to '||t.personnel_number,auth.uid());
  SELECT email INTO actor_email FROM auth.users WHERE id=auth.uid();
  INSERT INTO public.audit_logs(user_id,user_email,action_type,resource_type,resource_id,resource_number,metadata)
    VALUES(auth.uid(),coalesce(actor_email,''),'move_onboarding','personnel',t.id,t.personnel_number,
      jsonb_build_object('source_id',s.id,'target_id',t.id,'source_number',s.personnel_number,'target_number',t.personnel_number,
        'tables',results,'filled_fields',filled,'chosen_fields',chosen));
  RETURN jsonb_build_object('success',true,'source_id',s.id,'target_id',t.id,'tables',results,'filled_fields',filled,'chosen_fields',chosen);
END;
$function$;
REVOKE ALL ON FUNCTION public.move_onboarding_to_personnel(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_onboarding_to_personnel(uuid,uuid,jsonb) TO authenticated;
