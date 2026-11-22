CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE(id uuid, email text, role public.app_role, status text, expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN RAISE EXCEPTION 'Invalid invitation' USING ERRCODE='22023'; END IF;
  RETURN QUERY SELECT i.id, i.email, i.role, i.status::text, i.expires_at
    FROM public.invitations i
    WHERE i.token::text = p_token AND i.status='pending' AND i.expires_at > now()
    LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired invitation' USING ERRCODE='P0002'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;