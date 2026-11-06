CREATE TABLE public.timesheet_signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.project_locations(id) ON DELETE CASCADE,
  sheet_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','cancelled')),
  sms_status text NOT NULL DEFAULT 'sending' CHECK (sms_status IN ('sending','sent','failed','unknown')),
  sms_error text,
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  signed_at timestamptz,
  visit_personnel_id uuid
);
CREATE UNIQUE INDEX timesheet_sig_req_one_pending ON public.timesheet_signature_requests(personnel_id, location_id, sheet_date) WHERE status = 'pending';
CREATE INDEX timesheet_sig_req_loc_day ON public.timesheet_signature_requests(location_id, sheet_date);
GRANT SELECT ON public.timesheet_signature_requests TO authenticated;
GRANT ALL ON public.timesheet_signature_requests TO service_role;
ALTER TABLE public.timesheet_signature_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read signature requests" ON public.timesheet_signature_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));