CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS private.job_secrets (name text PRIMARY KEY, value text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON private.job_secrets FROM PUBLIC, anon, authenticated;
INSERT INTO private.job_secrets(name, value) VALUES ('cron_job_secret', encode(extensions.gen_random_bytes(48), 'hex')) ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_cron_secret(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_token IS NOT NULL AND length(p_token) >= 32 AND EXISTS (
    SELECT 1 FROM private.job_secrets WHERE name = 'cron_job_secret' AND value = p_token
  )
$$;
REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;