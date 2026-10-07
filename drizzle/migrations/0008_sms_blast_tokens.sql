CREATE TABLE public.sms_blast_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  posting_id uuid,
  max_recipients int,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sms_blast_tokens TO service_role;
ALTER TABLE public.sms_blast_tokens ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.sms_blast_tokens IS 'Single-use tokens authorizing send-bulk-applicant-sms. Service-role only; intentionally no RLS policies.';