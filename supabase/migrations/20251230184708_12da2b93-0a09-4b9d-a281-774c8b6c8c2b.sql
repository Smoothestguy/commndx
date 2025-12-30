-- Add SMS consent columns to applications table
ALTER TABLE public.applications 
  ADD COLUMN IF NOT EXISTS sms_consent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_phone text,
  ADD COLUMN IF NOT EXISTS sms_consent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS sms_confirmation_sent_at timestamp with time zone;