-- Add error-tracking column for silent-failure visibility
ALTER TABLE public.application_attempts
  ADD COLUMN IF NOT EXISTS last_error text;

-- RPC callable by anon/authenticated on the public application form to log
-- an error (e.g. photo upload failed) against the current session's attempt row.
CREATE OR REPLACE FUNCTION public.log_application_attempt_error(
  _session_id text,
  _job_posting_id uuid,
  _last_error text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _session_id IS NULL OR length(_session_id) < 8 OR length(_session_id) > 100 THEN
    RAISE EXCEPTION 'invalid session id';
  END IF;

  IF _last_error IS NULL OR length(trim(_last_error)) = 0 THEN
    RETURN;
  END IF;

  -- Trim to 500 chars to prevent abuse
  INSERT INTO public.application_attempts AS aa
    (session_id, job_posting_id, last_error)
  VALUES
    (_session_id, _job_posting_id, left(_last_error, 500))
  ON CONFLICT (session_id, job_posting_id) DO UPDATE
     SET last_error = left(EXCLUDED.last_error, 500),
         updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_application_attempt_error(text, uuid, text) TO anon, authenticated;