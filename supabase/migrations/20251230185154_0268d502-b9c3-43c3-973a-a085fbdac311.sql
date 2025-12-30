-- Add TCPA compliance columns to applications table
ALTER TABLE public.applications 
  ADD COLUMN IF NOT EXISTS sms_consent_method text DEFAULT 'web_form',
  ADD COLUMN IF NOT EXISTS sms_consent_ip text,
  ADD COLUMN IF NOT EXISTS sms_consent_text_version text;