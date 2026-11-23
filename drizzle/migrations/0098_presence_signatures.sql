CREATE TABLE public.timesheet_presence_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.timesheet_signature_requests(id) ON DELETE RESTRICT,
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES public.project_locations(id) ON DELETE RESTRICT,
  sign_date date NOT NULL,
  signature_path text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  signed_via text NOT NULL DEFAULT 'presence_attest' CHECK (signed_via = 'presence_attest'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (personnel_id, location_id, sign_date)
);
CREATE INDEX timesheet_presence_sig_loc_day ON public.timesheet_presence_signatures (location_id, sign_date);
GRANT SELECT ON public.timesheet_presence_signatures TO authenticated;
GRANT ALL ON public.timesheet_presence_signatures TO service_role;
ALTER TABLE public.timesheet_presence_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read presence signatures" ON public.timesheet_presence_signatures FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));
COMMENT ON TABLE public.timesheet_presence_signatures IS 'Presence-only date attestations from dates-only signature requests. Never creates attendance or times.';