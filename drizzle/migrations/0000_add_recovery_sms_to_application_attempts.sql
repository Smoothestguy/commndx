ALTER TABLE public.application_attempts
  ADD COLUMN IF NOT EXISTS recovery_sms_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_sms_sid text;