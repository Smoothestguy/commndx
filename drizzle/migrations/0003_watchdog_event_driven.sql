ALTER TABLE public.watchdog_settings
  ADD COLUMN IF NOT EXISTS pending_run boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS running boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hourly_sweep_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_run_trigger text;

CREATE OR REPLACE FUNCTION public.notify_application_watchdog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://xfjjvznxkcckuwxmcsdc.supabase.co/functions/v1/application-watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamp2em54a2Nja3V3eG1jc2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NDI2MzYsImV4cCI6MjA4MDIxODYzNn0.niPH0QKKU-NLUw92T8wLMihrEP8YWb__wUNZ4UZ5owI'
    ),
    body := jsonb_build_object(
      'trigger', 'event',
      'event_type', NEW.event_type,
      'job_posting_id', NEW.job_posting_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_application_watchdog ON public.application_events;
CREATE TRIGGER trg_notify_application_watchdog
AFTER INSERT ON public.application_events
FOR EACH ROW EXECUTE FUNCTION public.notify_application_watchdog();