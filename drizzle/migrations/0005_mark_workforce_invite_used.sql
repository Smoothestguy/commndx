CREATE OR REPLACE FUNCTION public.mark_workforce_invite_used(_token text, _application_id uuid)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.quick_apply_invites
  SET used_at = COALESCE(used_at, now()),
      application_id = COALESCE(application_id, _application_id),
      updated_at = now()
  WHERE token = _token
    AND (expires_at IS NULL OR expires_at > now());
$$;

REVOKE ALL ON FUNCTION public.mark_workforce_invite_used(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_workforce_invite_used(text, uuid) TO anon, authenticated, service_role;