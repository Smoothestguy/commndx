DO $lockdown$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature,p.proname,p.prorettype FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',f.signature);
  IF f.prorettype='trigger'::regtype OR f.proname IN ('sync_visit_time_entry','increment_unread_count') THEN
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated',f.signature);
  ELSIF f.proname = ANY(ARRAY['get_join_info','join_project','site_punch','kiosk_punch','kiosk_badge_punch','kiosk_find_person','get_kiosk_info','get_site_checkin_info','customer_portal_overview','customer_portal_messages','customer_portal_task_orders','customer_submit_task_order','customer_post_message','agency_portal_overview','agency_portal_week','get_photo_request_info','set_photo_by_token','get_quick_apply_invite','confirm_quick_apply','validate_onboarding_token','complete_personnel_onboarding','complete_vendor_onboarding','get_workforce_invite','mark_workforce_invite_opened','mark_workforce_invite_used','request_shift_extension','create_applicant_return_id','create_application_return_id','record_applicant_intake','save_application_attempt','log_application_event','log_application_attempt_error','update_applicant_profile_on_submit','has_active_application_for_posting','check_returning_contact','get_public_signin_providers']) THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated',f.signature);
  END IF;
 END LOOP;
END $lockdown$;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER TABLE public._backup_conversation_messages_20260715 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_conversation_participants_20260715 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_conversations_20260715 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._backup_conversation_messages_20260715, public._backup_conversation_participants_20260715, public._backup_conversations_20260715 FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.accept_invitation(_invitation_id uuid, _user_id uuid) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _invitation RECORD; _user_email text; _user_meta jsonb; _assigned_role app_role;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO _invitation FROM public.invitations WHERE id=_invitation_id AND status='pending' AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired invitation'; END IF;
 SELECT email,raw_user_meta_data INTO _user_email,_user_meta FROM auth.users WHERE id=_user_id;
 IF _user_email IS NULL OR lower(_user_email)<>lower(_invitation.email) THEN RAISE EXCEPTION 'User email does not match invitation'; END IF;
 INSERT INTO public.profiles(id,email,first_name,last_name) VALUES(_user_id,_user_email,COALESCE(_user_meta->>'first_name',''),COALESCE(_user_meta->>'last_name','')) ON CONFLICT(id) DO NOTHING;
 DELETE FROM public.user_roles WHERE user_id=_user_id;
 _assigned_role:=CASE WHEN _invitation.personnel_id IS NOT NULL THEN 'personnel'::app_role ELSE _invitation.role END;
 INSERT INTO public.user_roles(user_id,role) VALUES(_user_id,_assigned_role);
 UPDATE public.invitations SET status='accepted',used_at=now() WHERE id=_invitation_id;
 IF _invitation.personnel_id IS NOT NULL THEN UPDATE public.personnel SET user_id=_user_id WHERE id=_invitation.personnel_id; END IF;
 RETURN json_build_object('success',true,'role',_assigned_role,'personnel_id',_invitation.personnel_id);
END $function$;
REVOKE ALL ON FUNCTION public.accept_invitation(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid,uuid) TO authenticated,service_role;