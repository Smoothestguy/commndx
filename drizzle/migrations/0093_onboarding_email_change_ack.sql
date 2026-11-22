CREATE OR REPLACE FUNCTION public.acknowledge_onboarding_email_change(p_personnel_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uemail text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  UPDATE personnel SET email_bounced_at = NULL WHERE id = p_personnel_id AND email_bounced_at IS NOT NULL;
  INSERT INTO onboarding_delivery_alert_keys(event_key, delivery_id, token_id)
  SELECT 'email:' || coalesce(d.resend_id, d.id::text) || ':' || d.final_status, d.id, d.token_id
  FROM onboarding_email_deliveries d WHERE d.personnel_id = p_personnel_id AND d.final_status IN ('bounced','complained','failed')
  ON CONFLICT (event_key) DO NOTHING;
  INSERT INTO onboarding_delivery_alert_keys(event_key, delivery_id, token_id)
  SELECT DISTINCT ON (d.token_id) 'token:' || d.token_id || ':not_opened', d.id, d.token_id
  FROM onboarding_email_deliveries d WHERE d.personnel_id = p_personnel_id AND d.token_id IS NOT NULL
  ORDER BY d.token_id, d.sent_at DESC
  ON CONFLICT (event_key) DO NOTHING;
  UPDATE admin_notifications SET is_read = true
  WHERE related_id = p_personnel_id AND notification_type = 'onboarding_delivery_alert' AND NOT is_read;
  SELECT email INTO uemail FROM auth.users WHERE id = auth.uid();
  INSERT INTO audit_logs(user_id, user_email, action_type, resource_type, resource_id, success, metadata)
  VALUES (auth.uid(), coalesce(uemail,''), 'personnel_email_changed', 'personnel', p_personnel_id, true, '{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.acknowledge_onboarding_email_change(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_onboarding_email_change(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_onboarding_delivery_warning(p_personnel_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE d public.onboarding_email_deliveries%ROWTYPE; t public.personnel_onboarding_tokens%ROWTYPE; s text;
BEGIN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT onboarding_status INTO s FROM public.personnel WHERE id=p_personnel_id;
 IF s IN ('completed','revoked') THEN RETURN '{}'::jsonb; END IF;
 SELECT * INTO d FROM public.onboarding_email_deliveries WHERE personnel_id=p_personnel_id AND token_id IS NOT NULL ORDER BY sent_at DESC,id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
 -- Warnings about an old address end once staff change the email.
 IF EXISTS(SELECT 1 FROM public.audit_logs WHERE resource_id=p_personnel_id AND action_type='personnel_email_changed' AND created_at>d.sent_at) THEN RETURN '{}'::jsonb; END IF;
 SELECT * INTO t FROM public.personnel_onboarding_tokens WHERE id=d.token_id;
 IF t.used_at IS NOT NULL OR t.revoked_at IS NOT NULL OR t.expires_at<=now() OR t.first_opened_at IS NOT NULL THEN RETURN '{}'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM public.personnel_onboarding_tokens WHERE personnel_id=p_personnel_id AND created_at>t.created_at AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now()) THEN RETURN '{}'::jsonb; END IF;
 RETURN jsonb_build_object('email_bounced',coalesce(d.final_status IN ('bounced','complained','failed'),false),'not_opened',d.sent_at<=now()-interval '24 hours');
END $function$;