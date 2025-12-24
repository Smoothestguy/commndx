-- Drop the trigger that uses net.http_post which is not available
DROP TRIGGER IF EXISTS on_vendor_insert_sync_to_quickbooks ON public.vendors;

-- Drop the function as well since it won't be used
DROP FUNCTION IF EXISTS public.trigger_sync_new_vendor_to_quickbooks();