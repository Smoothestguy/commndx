CREATE TABLE public.catchup_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.project_locations(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  revoked_at timestamptz,
  revoked_by uuid
);
GRANT SELECT ON public.catchup_links TO authenticated;
GRANT ALL ON public.catchup_links TO service_role;
ALTER TABLE public.catchup_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read catch-up links" ON public.catchup_links FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE INDEX catchup_links_location_idx ON public.catchup_links(location_id, expires_at);
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS phone_confirmed_at timestamptz;