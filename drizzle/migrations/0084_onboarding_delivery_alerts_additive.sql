ALTER TABLE public.personnel ADD COLUMN email_bounced_at timestamptz;
ALTER TABLE public.personnel_onboarding_tokens ADD COLUMN first_opened_at timestamptz;
CREATE TABLE public.onboarding_email_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 personnel_id uuid REFERENCES public.personnel(id) ON DELETE CASCADE,
 token_id uuid REFERENCES public.personnel_onboarding_tokens(id) ON DELETE CASCADE,
 invite_id uuid REFERENCES public.personnel_registration_invites(id) ON DELETE CASCADE,
 resend_id text NOT NULL UNIQUE, sent_at timestamptz NOT NULL DEFAULT now(),
 last_event text, final_status text, checked_at timestamptz,
 CONSTRAINT onboarding_delivery_target CHECK ((token_id IS NOT NULL AND invite_id IS NULL AND personnel_id IS NOT NULL) OR (invite_id IS NOT NULL AND token_id IS NULL))
);
GRANT SELECT ON public.onboarding_email_deliveries TO authenticated;
GRANT ALL ON public.onboarding_email_deliveries TO service_role;
ALTER TABLE public.onboarding_email_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY onboarding_delivery_staff_read ON public.onboarding_email_deliveries FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE INDEX onboarding_delivery_pending ON public.onboarding_email_deliveries(sent_at) WHERE final_status IS NULL;
CREATE TABLE public.onboarding_delivery_alert_keys (
 event_key text PRIMARY KEY, delivery_id uuid REFERENCES public.onboarding_email_deliveries(id) ON DELETE CASCADE,
 token_id uuid REFERENCES public.personnel_onboarding_tokens(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.onboarding_delivery_alert_keys TO service_role;
ALTER TABLE public.onboarding_delivery_alert_keys ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.mark_onboarding_link_opened(p_token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_token IS NULL OR length(p_token)>256 THEN RETURN; END IF;
 UPDATE public.personnel_onboarding_tokens SET first_opened_at=now()
 WHERE token=p_token AND first_opened_at IS NULL AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now();
END $$;
REVOKE ALL ON FUNCTION public.mark_onboarding_link_opened(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_onboarding_link_opened(text) TO anon,authenticated,service_role;
CREATE FUNCTION public.get_onboarding_delivery_warning(p_personnel_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.onboarding_email_deliveries%ROWTYPE; t public.personnel_onboarding_tokens%ROWTYPE; s text;
BEGIN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT onboarding_status INTO s FROM public.personnel WHERE id=p_personnel_id;
 IF s IN ('completed','revoked') THEN RETURN '{}'::jsonb; END IF;
 SELECT * INTO d FROM public.onboarding_email_deliveries WHERE personnel_id=p_personnel_id AND token_id IS NOT NULL ORDER BY sent_at DESC,id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
 SELECT * INTO t FROM public.personnel_onboarding_tokens WHERE id=d.token_id;
 IF t.used_at IS NOT NULL OR t.revoked_at IS NOT NULL OR t.expires_at<=now() OR t.first_opened_at IS NOT NULL THEN RETURN '{}'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM public.personnel_onboarding_tokens WHERE personnel_id=p_personnel_id AND created_at>t.created_at AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now()) THEN RETURN '{}'::jsonb; END IF;
 RETURN jsonb_build_object('email_bounced',coalesce(d.final_status IN ('bounced','complained','failed'),false),'not_opened',d.sent_at<=now()-interval '24 hours');
END $$;
REVOKE ALL ON FUNCTION public.get_onboarding_delivery_warning(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_onboarding_delivery_warning(uuid) TO authenticated;
CREATE FUNCTION public.record_onboarding_delivery_alert(p_delivery_id uuid,p_event text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.onboarding_email_deliveries%ROWTYPE; t public.personnel_onboarding_tokens%ROWTYPE; pid uuid; k text; ttl text; target text;
BEGIN
 IF p_event NOT IN ('bounced','complained','failed','not_opened') THEN RETURN; END IF;
 SELECT * INTO d FROM public.onboarding_email_deliveries WHERE id=p_delivery_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 pid:=d.personnel_id;
 IF d.token_id IS NOT NULL THEN
  SELECT * INTO t FROM public.personnel_onboarding_tokens WHERE id=d.token_id;
  IF t.used_at IS NOT NULL OR t.revoked_at IS NOT NULL OR t.expires_at<=now() OR t.first_opened_at IS NOT NULL THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.onboarding_email_deliveries WHERE personnel_id=pid AND token_id IS NOT NULL AND sent_at>d.sent_at) THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.personnel WHERE id=pid AND onboarding_status IN ('completed','revoked')) THEN RETURN; END IF;
 ELSE
  SELECT r.personnel_id INTO pid FROM public.personnel_registrations r JOIN public.personnel_registration_invites i ON r.invite_token=i.token WHERE i.id=d.invite_id AND r.personnel_id IS NOT NULL LIMIT 1;
 END IF;
 IF p_event='not_opened' AND (d.token_id IS NULL OR d.sent_at>now()-interval '24 hours') THEN RETURN; END IF;
 k:=CASE WHEN p_event='not_opened' THEN 'token:'||d.token_id::text||':not_opened' ELSE 'email:'||d.resend_id||':'||p_event END;
 INSERT INTO public.onboarding_delivery_alert_keys(event_key,delivery_id,token_id) VALUES(k,d.id,d.token_id) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN; END IF;
 IF p_event<>'not_opened' AND pid IS NOT NULL THEN UPDATE public.personnel SET email_bounced_at=now() WHERE id=pid; END IF;
 ttl:=CASE WHEN p_event='not_opened' THEN 'Onboarding link not opened' ELSE 'Email bounced' END;
 target:=CASE WHEN pid IS NOT NULL THEN '/personnel/'||pid::text ELSE '/personnel?tab=registrations' END;
 INSERT INTO public.admin_notifications(user_id,title,message,notification_type,link_url,related_id,metadata,priority)
 SELECT DISTINCT user_id,ttl,CASE WHEN p_event='not_opened' THEN 'The onboarding link sent over 24 hours ago has not been opened.' ELSE 'Email delivery reported '||p_event||'. Review the email address before resending.' END,
 'onboarding_delivery_alert',target,pid,jsonb_build_object('delivery_id',d.id,'event',p_event,'personnel_id',pid,'invite_id',d.invite_id),'high'
 FROM public.user_roles WHERE role='admin';
END $$;
REVOKE ALL ON FUNCTION public.record_onboarding_delivery_alert(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_onboarding_delivery_alert(uuid,text) TO service_role;