CREATE TABLE public.signin_provider_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  google_client_id text,
  facebook_app_id text,
  apply_google_enabled boolean NOT NULL DEFAULT false,
  apply_facebook_enabled boolean NOT NULL DEFAULT false,
  staff_google_enabled boolean NOT NULL DEFAULT false,
  staff_facebook_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.signin_provider_settings TO authenticated;
GRANT ALL ON public.signin_provider_settings TO service_role;

ALTER TABLE public.signin_provider_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can read signin provider settings"
ON public.signin_provider_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can insert signin provider settings"
ON public.signin_provider_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can update signin provider settings"
ON public.signin_provider_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

INSERT INTO public.signin_provider_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_public_signin_providers()
RETURNS TABLE (
  google_client_id text,
  facebook_app_id text,
  apply_google_enabled boolean,
  apply_facebook_enabled boolean,
  staff_google_enabled boolean,
  staff_facebook_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE WHEN s.apply_google_enabled OR s.staff_google_enabled THEN s.google_client_id END,
    CASE WHEN s.apply_facebook_enabled OR s.staff_facebook_enabled THEN s.facebook_app_id END,
    s.apply_google_enabled,
    s.apply_facebook_enabled,
    s.staff_google_enabled,
    s.staff_facebook_enabled
  FROM public.signin_provider_settings s
  WHERE s.id = 1
$$;

GRANT EXECUTE ON FUNCTION public.get_public_signin_providers() TO anon, authenticated;

-- Lets a freshly signed-in OAuth user (no role yet) discover a pending
-- invitation addressed to their own verified email, without exposing the
-- invitations table.
CREATE OR REPLACE FUNCTION public.find_pending_invitation_for_me()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id
  FROM public.invitations i
  WHERE lower(i.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    AND i.status = 'pending'
    AND i.expires_at > now()
  ORDER BY i.created_at DESC
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.find_pending_invitation_for_me() TO authenticated;