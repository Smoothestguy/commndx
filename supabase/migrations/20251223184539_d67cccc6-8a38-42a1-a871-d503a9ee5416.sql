-- Enable pg_net extension for making HTTP requests from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to auto-sync new vendors to QuickBooks
CREATE OR REPLACE FUNCTION public.trigger_sync_new_vendor_to_quickbooks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qb_connected BOOLEAN := FALSE;
  request_id BIGINT;
  supabase_url TEXT := 'https://xfjjvznxkcckuwxmcsdc.supabase.co';
BEGIN
  -- Check if QuickBooks is connected
  SELECT is_connected INTO qb_connected 
  FROM quickbooks_config 
  LIMIT 1;

  IF qb_connected = TRUE THEN
    -- Call the edge function via HTTP to sync this vendor
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/quickbooks-sync-vendors',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamp2em54a2Nja3V3eG1jc2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NDI2MzYsImV4cCI6MjA4MDIxODYzNn0.niPH0QKKU-NLUw92T8wLMihrEP8YWb__wUNZ4UZ5owI'
      ),
      body := jsonb_build_object(
        'action', 'sync-single',
        'vendorId', NEW.id::text
      )::text
    ) INTO request_id;
    
    RAISE LOG 'QuickBooks sync triggered for vendor % (request_id: %)', NEW.id, request_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new vendor inserts
DROP TRIGGER IF EXISTS on_vendor_insert_sync_to_quickbooks ON public.vendors;
CREATE TRIGGER on_vendor_insert_sync_to_quickbooks
  AFTER INSERT ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_new_vendor_to_quickbooks();