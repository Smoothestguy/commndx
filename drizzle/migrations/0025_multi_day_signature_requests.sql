ALTER TABLE public.timesheet_signature_requests
  ADD COLUMN IF NOT EXISTS dates date[],
  ADD COLUMN IF NOT EXISTS send_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sent_by uuid;
COMMENT ON COLUMN public.timesheet_signature_requests.dates IS 'All local dates covered by one link; null means only sheet_date.';
CREATE INDEX IF NOT EXISTS timesheet_sig_req_person_loc_pending ON public.timesheet_signature_requests (personnel_id, location_id) WHERE status = 'pending';