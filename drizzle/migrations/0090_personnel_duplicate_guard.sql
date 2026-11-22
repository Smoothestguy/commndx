-- Names: trim + collapse internal whitespace on insert and name edits (contact normalization unchanged).
CREATE OR REPLACE FUNCTION public.normalize_contact_fields()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF TG_OP='INSERT' OR NEW.email IS DISTINCT FROM OLD.email THEN
    IF NEW.email IS NOT NULL THEN NEW.email := coalesce(public.normalize_email(NEW.email), NEW.email); END IF;
  END IF;
  IF TG_OP='INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone THEN
    NEW.phone := public.normalize_phone(NEW.phone);
  END IF;
  IF TG_TABLE_NAME='personnel' THEN
    IF TG_OP='INSERT' OR NEW.first_name IS DISTINCT FROM OLD.first_name THEN NEW.first_name := regexp_replace(btrim(NEW.first_name), '\s+', ' ', 'g'); END IF;
    IF TG_OP='INSERT' OR NEW.last_name IS DISTINCT FROM OLD.last_name THEN NEW.last_name := regexp_replace(btrim(NEW.last_name), '\s+', ' ', 'g'); END IF;
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS trg_normalize_contact ON public.personnel;
CREATE TRIGGER trg_normalize_contact BEFORE INSERT OR UPDATE OF email, phone, first_name, last_name ON public.personnel
  FOR EACH ROW EXECUTE FUNCTION public.normalize_contact_fields();

-- Shared matcher: strongest existing personnel match for a candidate row.
CREATE OR REPLACE FUNCTION public.personnel_duplicate_match(p_first text, p_last text, p_email text, p_phone text)
RETURNS TABLE(personnel_id uuid, personnel_number text, full_name text, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ph text := public.normalize_phone(p_phone); e text := public.normalize_email(p_email);
  nm text := public.normalize_person_name(coalesce(p_first,'') || ' ' || coalesce(p_last,''));
BEGIN
  IF ph IS NOT NULL AND length(ph) < 10 THEN ph := NULL; END IF;
  IF e LIKE '%.invalid' THEN e := NULL; END IF;
  RETURN QUERY
  SELECT p.id, p.personnel_number, btrim(p.first_name || ' ' || p.last_name),
    CASE WHEN ph IS NOT NULL AND public.normalize_phone(p.phone) = ph THEN 'same_phone'
         WHEN e IS NOT NULL AND public.normalize_email(p.email) = e THEN 'same_email' ELSE 'same_name' END
  FROM personnel p
  WHERE p.deleted_at IS NULL AND p.merged_into_id IS NULL
    AND ((ph IS NOT NULL AND public.normalize_phone(p.phone) = ph)
      OR (e IS NOT NULL AND public.normalize_email(p.email) = e)
      OR (nm IS NOT NULL AND public.normalize_person_name(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) = nm))
  ORDER BY 4 = 'same_phone' DESC, 4 = 'same_email' DESC, p.created_at
  LIMIT 1;
END $$;
REVOKE ALL ON FUNCTION public.personnel_duplicate_match(text,text,text,text) FROM PUBLIC, anon, authenticated;

-- INSERT-only guard. Never attached to UPDATE.
CREATE OR REPLACE FUNCTION public.guard_personnel_duplicate_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; real_contact boolean;
BEGIN
  IF coalesce(current_setting('app.personnel_dup_override', true), '') = 'on' THEN RETURN NEW; END IF;
  SELECT * INTO m FROM public.personnel_duplicate_match(NEW.first_name, NEW.last_name, NEW.email, NEW.phone);
  IF m.personnel_id IS NULL THEN RETURN NEW; END IF;
  real_contact := length(coalesce(public.normalize_phone(NEW.phone),'')) = 10
    OR (public.normalize_email(NEW.email) IS NOT NULL AND public.normalize_email(NEW.email) NOT LIKE '%.invalid');
  IF m.reason IN ('same_phone','same_email') OR NOT real_contact THEN
    RAISE EXCEPTION 'Duplicate: matches % % (%). Use the existing person or ask an admin to create anyway.',
      coalesce(m.personnel_number, 'existing record'), m.full_name, replace(m.reason, '_', ' ')
      USING ERRCODE = 'DP001',
            DETAIL = jsonb_build_object('personnel_id', m.personnel_id, 'personnel_number', m.personnel_number, 'full_name', m.full_name, 'reason', m.reason)::text;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_personnel_duplicate_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER zz_personnel_duplicate_guard BEFORE INSERT ON public.personnel
  FOR EACH ROW EXECUTE FUNCTION public.guard_personnel_duplicate_insert();

-- Name-only matches that were allowed (own phone/email): flag for review + admin bell.
CREATE OR REPLACE FUNCTION public.flag_personnel_name_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record;
BEGIN
  SELECT p.id, p.personnel_number, btrim(p.first_name || ' ' || p.last_name) AS full_name INTO m FROM personnel p
  WHERE p.id <> NEW.id AND p.deleted_at IS NULL AND p.merged_into_id IS NULL
    AND public.normalize_person_name(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) = public.normalize_person_name(coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,''))
  ORDER BY p.created_at LIMIT 1;
  IF m.id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO contact_review_items(source, reason, submitted_first_name, submitted_last_name, submitted_email, submitted_phone, matched_entity_type, matched_entity_id, submission_entity_type, submission_entity_id)
  VALUES ('personnel_insert', 'similar_name', NEW.first_name, NEW.last_name, NEW.email, NEW.phone, 'personnel', m.id, 'personnel', NEW.id);
  INSERT INTO admin_notifications(user_id, title, message, notification_type, link_url, related_id, metadata)
  SELECT ur.user_id, 'Possible duplicate person',
    format('%s %s was added and matches %s %s by name.', NEW.first_name, NEW.last_name, coalesce(m.personnel_number,''), m.full_name),
    'possible_duplicate', '/personnel/' || NEW.id, NEW.id, jsonb_build_object('matched_personnel_id', m.id)
  FROM user_roles ur WHERE ur.role = 'admin';
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.flag_personnel_name_match() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER zz_personnel_name_match_flag AFTER INSERT ON public.personnel
  FOR EACH ROW EXECUTE FUNCTION public.flag_personnel_name_match();

-- Admin-only "Create anyway" with reason. Transaction-local override flag; audited.
CREATE OR REPLACE FUNCTION public.create_personnel_override(p_payload jsonb, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cols text; vals text; v_id uuid; m record; uemail text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can create a duplicate' USING ERRCODE = '42501'; END IF;
  IF nullif(btrim(coalesce(p_reason,'')), '') IS NULL THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT string_agg(quote_ident(k), ','), string_agg(format('(r).%I', k), ',') INTO cols, vals
  FROM jsonb_object_keys(p_payload) k
  WHERE k NOT IN ('id','user_id','merged_into_id','deleted_at','created_at','updated_at')
    AND EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='personnel' AND c.column_name=k);
  IF cols IS NULL THEN RAISE EXCEPTION 'Nothing to insert'; END IF;
  SELECT * INTO m FROM public.personnel_duplicate_match(p_payload->>'first_name', p_payload->>'last_name', p_payload->>'email', p_payload->>'phone');
  PERFORM set_config('app.personnel_dup_override', 'on', true);
  EXECUTE format('INSERT INTO personnel(%s) SELECT %s FROM jsonb_populate_record(NULL::personnel, $1) r RETURNING id', cols, vals) USING p_payload INTO v_id;
  PERFORM set_config('app.personnel_dup_override', 'off', true);
  SELECT email INTO uemail FROM auth.users WHERE id = auth.uid();
  INSERT INTO audit_logs(user_id, user_email, action_type, resource_type, resource_id, success, metadata)
  VALUES (auth.uid(), coalesce(uemail,''), 'duplicate_create_anyway', 'personnel', v_id::text, true,
    jsonb_build_object('reason', btrim(p_reason), 'matched_personnel_id', m.personnel_id, 'matched_number', m.personnel_number, 'match_reason', m.reason));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.create_personnel_override(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_personnel_override(jsonb, text) TO authenticated;