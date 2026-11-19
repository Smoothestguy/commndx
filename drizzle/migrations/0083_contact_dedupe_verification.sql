CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.normalize_email(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT nullif(lower(btrim(p)),'') $$;
CREATE OR REPLACE FUNCTION public.normalize_phone(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT nullif(right(regexp_replace(coalesce(p,''),'[^0-9]','','g'),10),'') $$;
CREATE OR REPLACE FUNCTION public.normalize_person_name(p text) RETURNS text LANGUAGE sql STABLE SET search_path=public,extensions AS $$ SELECT nullif(regexp_replace(lower(extensions.unaccent(btrim(coalesce(p,'')))),'\s+',' ','g'),'') $$;

-- Only touches email/phone; never raises, so unrelated updates (punch, kiosk, time) are unaffected.
CREATE OR REPLACE FUNCTION public.normalize_contact_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.email IS DISTINCT FROM OLD.email THEN
    IF NEW.email IS NOT NULL THEN NEW.email := coalesce(public.normalize_email(NEW.email), NEW.email); END IF;
  END IF;
  IF TG_OP='INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone THEN
    NEW.phone := public.normalize_phone(NEW.phone);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.normalize_contact_fields() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_normalize_contact BEFORE INSERT OR UPDATE OF email, phone ON public.personnel FOR EACH ROW EXECUTE FUNCTION public.normalize_contact_fields();
CREATE TRIGGER trg_normalize_contact BEFORE INSERT OR UPDATE OF email, phone ON public.applicants FOR EACH ROW EXECUTE FUNCTION public.normalize_contact_fields();
CREATE TRIGGER trg_normalize_contact BEFORE INSERT OR UPDATE OF email, phone ON public.personnel_registrations FOR EACH ROW EXECUTE FUNCTION public.normalize_contact_fields();

-- Formatting-only backfill; applicant emails that would collide after lowercasing are left as-is.
UPDATE public.personnel SET email=public.normalize_email(email) WHERE email IS NOT NULL AND email<>public.normalize_email(email) AND public.normalize_email(email) IS NOT NULL;
UPDATE public.personnel SET phone=public.normalize_phone(phone) WHERE phone IS DISTINCT FROM public.normalize_phone(phone);
UPDATE public.applicants a SET email=public.normalize_email(a.email) WHERE a.email<>public.normalize_email(a.email) AND public.normalize_email(a.email) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.applicants b WHERE b.id<>a.id AND public.normalize_email(b.email)=public.normalize_email(a.email));
UPDATE public.applicants SET phone=public.normalize_phone(phone) WHERE phone IS DISTINCT FROM public.normalize_phone(phone);

ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS email_verified_at timestamptz, ADD COLUMN IF NOT EXISTS email_verified_source text, ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz, ADD COLUMN IF NOT EXISTS phone_verified_source text;
ALTER TABLE public.personnel_registrations ADD COLUMN IF NOT EXISTS email_verified_at timestamptz, ADD COLUMN IF NOT EXISTS email_verified_source text, ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz, ADD COLUMN IF NOT EXISTS phone_verified_source text, ADD COLUMN IF NOT EXISTS email_verification_proof uuid, ADD COLUMN IF NOT EXISTS phone_verification_proof uuid, ADD COLUMN IF NOT EXISTS invite_token text;
ALTER TABLE public.personnel_onboarding_tokens ADD COLUMN IF NOT EXISTS sent_via text NOT NULL DEFAULT 'email';
ALTER TABLE public.personnel_registration_invites ADD COLUMN IF NOT EXISTS sent_via text NOT NULL DEFAULT 'email';

CREATE TABLE public.contact_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_type text NOT NULL CHECK (contact_type IN ('email','phone')),
  contact text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('onboarding','registration','apply')),
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  consumed_at timestamptz,
  send_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contact_verification_codes_contact_idx ON public.contact_verification_codes(contact_type, contact, created_at DESC);
GRANT ALL ON public.contact_verification_codes TO service_role;
ALTER TABLE public.contact_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.contact_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  reason text NOT NULL,
  submitted_first_name text, submitted_last_name text, submitted_email text, submitted_phone text,
  matched_entity_type text NOT NULL, matched_entity_id uuid NOT NULL,
  submission_entity_type text, submission_entity_id uuid,
  job_posting_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  decision text CHECK (decision IN ('update_contact','keep_existing','different_person')),
  decided_by uuid, decided_at timestamptz, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contact_review_items TO authenticated;
GRANT ALL ON public.contact_review_items TO service_role;
ALTER TABLE public.contact_review_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers view contact reviews" ON public.contact_review_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TABLE public.duplicate_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL DEFAULT 'personnel',
  entity_ids uuid[] NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_ids)
);
GRANT SELECT ON public.duplicate_dismissals TO authenticated;
GRANT ALL ON public.duplicate_dismissals TO service_role;
ALTER TABLE public.duplicate_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers view dismissals" ON public.duplicate_dismissals FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE OR REPLACE FUNCTION public._is_staff_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(auth.role(),'')='service_role' OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') $$;
REVOKE ALL ON FUNCTION public._is_staff_manager() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._is_staff_manager() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._names_similar(f1 text,l1 text,f2 text,l2 text) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE a text:=public.normalize_person_name(f1); b text:=public.normalize_person_name(l1); c text:=public.normalize_person_name(f2); d text:=public.normalize_person_name(l2);
BEGIN
  IF a IS NULL OR b IS NULL OR c IS NULL OR d IS NULL THEN RETURN false; END IF;
  IF split_part(a,' ',1)<>split_part(c,' ',1) THEN RETURN false; END IF;
  RETURN b=d OR d LIKE b||' %' OR b LIKE d||' %';
END $$;

CREATE OR REPLACE FUNCTION public.find_contact_matches(p_first_name text, p_last_name text, p_email text, p_phone text)
RETURNS TABLE(entity_type text, entity_id uuid, full_name text, ref_number text, email text, phone text, created_at timestamptz, reasons text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE e text:=public.normalize_email(p_email); ph text:=public.normalize_phone(p_phone);
BEGIN
  IF NOT public._is_staff_manager() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  IF ph IS NOT NULL AND length(ph)<10 THEN ph:=NULL; END IF;
  RETURN QUERY
  SELECT * FROM (
    SELECT 'personnel'::text, p.id, btrim(p.first_name||' '||p.last_name), p.personnel_number, p.email, p.phone, p.created_at,
      array_remove(ARRAY[CASE WHEN e IS NOT NULL AND public.normalize_email(p.email)=e THEN 'same_email' END,
                         CASE WHEN ph IS NOT NULL AND public.normalize_phone(p.phone)=ph THEN 'same_phone' END,
                         CASE WHEN public._names_similar(p_first_name,p_last_name,p.first_name,p.last_name) THEN 'similar_name' END], NULL)
    FROM public.personnel p WHERE p.deleted_at IS NULL
    UNION ALL
    SELECT 'applicant', a.id, btrim(a.first_name||' '||a.last_name), NULL, a.email, a.phone, a.created_at,
      array_remove(ARRAY[CASE WHEN e IS NOT NULL AND public.normalize_email(a.email)=e THEN 'same_email' END,
                         CASE WHEN ph IS NOT NULL AND public.normalize_phone(a.phone)=ph THEN 'same_phone' END,
                         CASE WHEN public._names_similar(p_first_name,p_last_name,a.first_name,a.last_name) THEN 'similar_name' END], NULL)
    FROM public.applicants a WHERE a.merged_into_id IS NULL AND a.status::text <> 'archived'
  ) m(entity_type, entity_id, full_name, ref_number, email, phone, created_at, reasons)
  WHERE cardinality(m.reasons)>0
  ORDER BY ('same_email'=ANY(m.reasons)) DESC, ('same_phone'=ANY(m.reasons)) DESC, m.entity_type DESC, m.created_at
  LIMIT 25;
END $$;
REVOKE ALL ON FUNCTION public.find_contact_matches(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_contact_matches(text,text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.personnel_duplicate_groups()
RETURNS TABLE(reason text, match_key text, personnel jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public._is_staff_manager() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  RETURN QUERY
  WITH base AS (
    SELECT p.id, p.first_name, p.last_name, p.personnel_number, p.email, p.phone, p.status::text st, p.created_at,
      public.normalize_email(p.email) ne, public.normalize_phone(p.phone) np,
      split_part(public.normalize_person_name(p.first_name),' ',1)||'|'||split_part(public.normalize_person_name(p.last_name),' ',1) nk
    FROM public.personnel p WHERE p.deleted_at IS NULL
  ), keyed AS (
    SELECT 'same_email' r, ne k, id FROM base WHERE ne IS NOT NULL
    UNION ALL SELECT 'same_phone', np, id FROM base WHERE np IS NOT NULL AND length(np)=10
    UNION ALL SELECT 'similar_name', nk, id FROM base WHERE nk NOT LIKE '|%' AND nk NOT LIKE '%|'
  ), groups AS (
    SELECT r, k, array_agg(id ORDER BY id) ids FROM keyed GROUP BY r, k HAVING count(*)>1
  )
  SELECT g.r, g.k, (SELECT jsonb_agg(jsonb_build_object('id',b.id,'name',btrim(b.first_name||' '||b.last_name),'personnel_number',b.personnel_number,'email',b.email,'phone',b.phone,'status',b.st,'created_at',b.created_at) ORDER BY b.created_at) FROM base b WHERE b.id=ANY(g.ids))
  FROM groups g
  WHERE NOT EXISTS (SELECT 1 FROM public.duplicate_dismissals d WHERE d.entity_type='personnel' AND d.entity_ids @> g.ids)
  ORDER BY g.r, g.k;
END $$;
REVOKE ALL ON FUNCTION public.personnel_duplicate_groups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personnel_duplicate_groups() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dismiss_duplicate_group(p_ids uuid[], p_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s uuid[]; em text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  SELECT array_agg(x ORDER BY x) INTO s FROM (SELECT DISTINCT unnest(p_ids) x) q;
  IF cardinality(s)<2 THEN RAISE EXCEPTION 'Need at least two records'; END IF;
  INSERT INTO public.duplicate_dismissals(entity_type,entity_ids,reason,created_by) VALUES('personnel',s,p_reason,auth.uid()) ON CONFLICT DO NOTHING;
  SELECT email INTO em FROM auth.users WHERE id=auth.uid();
  INSERT INTO public.audit_logs(user_id,user_email,action_type,resource_type,success,metadata)
  VALUES(auth.uid(),coalesce(em,''),'duplicate_dismissed','personnel',true,jsonb_build_object('personnel_ids',s,'reason',p_reason));
END $$;
REVOKE ALL ON FUNCTION public.dismiss_duplicate_group(uuid[],text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_duplicate_group(uuid[],text) TO authenticated;

-- Proofs: a code row verified within 30 minutes, for the same normalized contact, used once.
CREATE OR REPLACE FUNCTION public.consume_contact_proof(p_proof uuid, p_type text, p_contact text, p_purpose text) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c text:=CASE p_type WHEN 'email' THEN public.normalize_email(p_contact) ELSE public.normalize_phone(p_contact) END; t timestamptz;
BEGIN
  IF p_proof IS NULL OR c IS NULL THEN RETURN NULL; END IF;
  UPDATE public.contact_verification_codes SET consumed_at=now()
   WHERE id=p_proof AND contact_type=p_type AND contact=c AND purpose=p_purpose AND verified_at IS NOT NULL AND consumed_at IS NULL AND verified_at>now()-interval '30 minutes'
   RETURNING verified_at INTO t;
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.consume_contact_proof(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_contact_proof(uuid,text,text,text) TO service_role;

-- Onboarding: link channel proves the contact it was sent to; other contacts need a proof; never blocks.
CREATE OR REPLACE FUNCTION public.record_onboarding_contact_verification(p_token text, p_email text, p_phone text, p_email_proof uuid DEFAULT NULL, p_phone_proof uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tok public.personnel_onboarding_tokens%ROWTYPE; p public.personnel%ROWTYPE; e text:=public.normalize_email(p_email); ph text:=public.normalize_phone(p_phone);
  ev timestamptz; es text; pv timestamptz; ps text;
BEGIN
  SELECT * INTO tok FROM public.personnel_onboarding_tokens WHERE token=p_token AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now();
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false); END IF;
  SELECT * INTO p FROM public.personnel WHERE id=tok.personnel_id;
  IF tok.sent_via='email' AND e IS NOT NULL AND e=public.normalize_email(p.email) THEN ev:=now(); es:='link_email';
  ELSE ev:=public.consume_contact_proof(p_email_proof,'email',e,'onboarding'); es:=CASE WHEN ev IS NOT NULL THEN 'code' END; END IF;
  IF tok.sent_via='sms' AND ph IS NOT NULL AND ph=public.normalize_phone(p.phone) THEN pv:=now(); ps:='link_sms';
  ELSE pv:=public.consume_contact_proof(p_phone_proof,'phone',ph,'onboarding'); ps:=CASE WHEN pv IS NOT NULL THEN 'code' END; END IF;
  UPDATE public.personnel SET email_verified_at=ev, email_verified_source=es, phone_verified_at=pv, phone_verified_source=ps WHERE id=p.id;
  RETURN jsonb_build_object('success',true,'email_verified',ev IS NOT NULL,'phone_verified',pv IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.record_onboarding_contact_verification(text,text,text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_onboarding_contact_verification(text,text,text,uuid,uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.onboarding_link_channel(p_token text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT sent_via FROM public.personnel_onboarding_tokens WHERE token=p_token AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now() $$;
REVOKE ALL ON FUNCTION public.onboarding_link_channel(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_link_channel(text) TO anon, authenticated, service_role;

-- Registrations: verified stamps come only from proofs or the invite channel; client values are discarded.
CREATE OR REPLACE FUNCTION public.registration_contact_verification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inv public.personnel_registration_invites%ROWTYPE;
BEGIN
  NEW.email_verified_at:=NULL; NEW.email_verified_source:=NULL; NEW.phone_verified_at:=NULL; NEW.phone_verified_source:=NULL;
  IF NEW.invite_token IS NOT NULL THEN
    SELECT * INTO inv FROM public.personnel_registration_invites WHERE token=NEW.invite_token AND expires_at>now();
    IF FOUND THEN
      IF inv.sent_via='email' AND public.normalize_email(inv.email)=public.normalize_email(NEW.email) THEN NEW.email_verified_at:=now(); NEW.email_verified_source:='link_email'; END IF;
    END IF;
  END IF;
  IF NEW.email_verified_at IS NULL THEN
    NEW.email_verified_at:=public.consume_contact_proof(NEW.email_verification_proof,'email',NEW.email,'registration');
    IF NEW.email_verified_at IS NOT NULL THEN NEW.email_verified_source:='code'; END IF;
  END IF;
  NEW.phone_verified_at:=public.consume_contact_proof(NEW.phone_verification_proof,'phone',NEW.phone,'registration');
  IF NEW.phone_verified_at IS NOT NULL THEN NEW.phone_verified_source:='code'; END IF;
  NEW.invite_token:=NULL;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.registration_contact_verification() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_registration_contact_verification BEFORE INSERT ON public.personnel_registrations FOR EACH ROW EXECUTE FUNCTION public.registration_contact_verification();

CREATE OR REPLACE FUNCTION public.resolve_contact_review(p_item uuid, p_decision text, p_notes text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE it public.contact_review_items%ROWTYPE; before jsonb; em text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  IF p_decision NOT IN ('update_contact','keep_existing','different_person') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  SELECT * INTO it FROM public.contact_review_items WHERE id=p_item AND status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review item not open'; END IF;
  IF p_decision='update_contact' THEN
    IF it.matched_entity_type='applicant' THEN
      SELECT jsonb_build_object('email',email,'phone',phone) INTO before FROM public.applicants WHERE id=it.matched_entity_id;
      UPDATE public.applicants SET phone=coalesce(public.normalize_phone(it.submitted_phone),phone),
        email=CASE WHEN it.submitted_email IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.applicants x WHERE x.email=public.normalize_email(it.submitted_email) AND x.id<>it.matched_entity_id) THEN public.normalize_email(it.submitted_email) ELSE email END
       WHERE id=it.matched_entity_id;
      IF it.submission_entity_type='applicant' AND it.submission_entity_id IS NOT NULL AND it.submission_entity_id<>it.matched_entity_id THEN
        UPDATE public.applications SET applicant_id=it.matched_entity_id WHERE applicant_id=it.submission_entity_id;
        UPDATE public.applicants SET status='archived', merged_into_id=it.matched_entity_id WHERE id=it.submission_entity_id;
      END IF;
    ELSE
      SELECT jsonb_build_object('email',email,'phone',phone) INTO before FROM public.personnel WHERE id=it.matched_entity_id;
      UPDATE public.personnel SET phone=coalesce(public.normalize_phone(it.submitted_phone),phone), email=coalesce(public.normalize_email(it.submitted_email),email),
        email_verified_at=NULL, phone_verified_at=NULL WHERE id=it.matched_entity_id;
    END IF;
  END IF;
  UPDATE public.contact_review_items SET status='resolved', decision=p_decision, decided_by=auth.uid(), decided_at=now(), notes=p_notes WHERE id=it.id;
  SELECT email INTO em FROM auth.users WHERE id=auth.uid();
  INSERT INTO public.audit_logs(user_id,user_email,action_type,resource_type,resource_id,changes_before,success,metadata)
  VALUES(auth.uid(),coalesce(em,''),'contact_review_'||p_decision,it.matched_entity_type,it.matched_entity_id,before,true,
    jsonb_build_object('review_item',it.id,'submitted_email',it.submitted_email,'submitted_phone',it.submitted_phone,'notes',p_notes));
  RETURN jsonb_build_object('success',true);
END $$;
REVOKE ALL ON FUNCTION public.resolve_contact_review(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_contact_review(uuid,text,text) TO authenticated;

-- Apply form: no unproven contact overwrite. Single-contact matches need a code; skip creates a review item.
DO $do$ DECLARE d text; n int; BEGIN
SELECT pg_get_functiondef('public.submit_public_application(uuid,jsonb,jsonb,uuid)'::regprocedure) INTO d;
n:=length(d);
d:=replace(d,'next_id uuid;','next_id uuid; conflict text; proof timestamptz; old_contact jsonb; review_source uuid;');
d:=replace(d,'UPDATE public.applicants SET email=e,phone=coalesce(nullif(ph,''''),phone),first_name=',
$r$conflict:=NULL;
   IF lower(btrim(a.email))=e THEN
    IF length(ph)>=10 AND public.normalize_phone(a.phone) IS NOT NULL AND public.normalize_phone(a.phone)<>ph THEN conflict:='email'; END IF;
   ELSE conflict:='phone'; END IF;
   IF conflict IS NOT NULL THEN
    proof:=public.consume_contact_proof(nullif(p_submission#>>'{verification,proof_id}','')::uuid, CASE conflict WHEN 'email' THEN 'email' ELSE 'phone' END, CASE conflict WHEN 'email' THEN e ELSE ph END, 'apply');
    IF proof IS NOT NULL THEN
     old_contact:=jsonb_build_object('email',a.email,'phone',a.phone);
     IF conflict='email' THEN UPDATE public.applicants SET phone=ph WHERE id=a.id; ELSE UPDATE public.applicants SET email=e WHERE id=a.id; END IF;
     INSERT INTO public.audit_logs(user_email,action_type,resource_type,resource_id,changes_before,changes_after,success,metadata)
     VALUES('public-apply','contact_verified_update','applicant',a.id,old_contact,jsonb_build_object('email',e,'phone',ph),true,jsonb_build_object('verified_channel',conflict,'job_posting_id',p_posting));
    ELSIF coalesce((p_submission#>>'{verification,skip}')::boolean,false) THEN
     review_source:=a.id;
     IF conflict='phone' THEN
      INSERT INTO public.applicants(first_name,last_name,email,phone,address,city,state,home_zip,photo_url,vendor_id) VALUES(btrim(p_applicant->>'first_name'),btrim(p_applicant->>'last_name'),e,nullif(ph,''),nullif(btrim(p_applicant->>'address'),''),nullif(btrim(p_applicant->>'city'),''),nullif(btrim(p_applicant->>'state'),''),nullif(btrim(p_applicant->>'home_zip'),''),nullif(p_applicant->>'photo_url',''),p_vendor) RETURNING * INTO a;
      existing:=false;
     END IF;
     IF NOT EXISTS(SELECT 1 FROM public.contact_review_items WHERE status='open' AND source='apply' AND matched_entity_id=review_source AND submitted_email=e AND submitted_phone IS NOT DISTINCT FROM nullif(ph,'') AND job_posting_id=p_posting) THEN
      INSERT INTO public.contact_review_items(source,reason,submitted_first_name,submitted_last_name,submitted_email,submitted_phone,matched_entity_type,matched_entity_id,submission_entity_type,submission_entity_id,job_posting_id)
      VALUES('apply',CASE conflict WHEN 'email' THEN 'email_match_phone_differs' ELSE 'phone_match_email_differs' END,btrim(p_applicant->>'first_name'),btrim(p_applicant->>'last_name'),e,nullif(ph,''),'applicant',review_source,'applicant',a.id,p_posting);
     END IF;
    ELSE
     RETURN jsonb_build_object('status','verification_required','channel',CASE conflict WHEN 'email' THEN 'email' ELSE 'sms' END);
    END IF;
   END IF;
   UPDATE public.applicants SET phone=coalesce(nullif(phone,''),nullif(ph,'')),first_name=$r$);
IF length(d)<=n+200 THEN RAISE EXCEPTION 'submit_public_application patch did not apply'; END IF;
EXECUTE d;
END $do$;
REVOKE ALL ON FUNCTION public.submit_public_application(uuid,jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_application(uuid,jsonb,jsonb,uuid) TO service_role;