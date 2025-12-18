-- Fix vendor bill number generator race condition using advisory lock
CREATE OR REPLACE FUNCTION public.generate_vendor_bill_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_year TEXT;
  seq_number INTEGER;
  lock_key BIGINT := 123456789; -- Unique lock key for vendor bill numbers
BEGIN
  -- Acquire an advisory lock to prevent race conditions during concurrent inserts
  PERFORM pg_advisory_xact_lock(lock_key);
  
  current_year := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 6) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.vendor_bills
  WHERE number LIKE 'BILL-' || current_year || '%';
  RETURN 'BILL-' || current_year || LPAD(seq_number::TEXT, 5, '0');
END;
$function$;

-- Fix personnel payment number generator race condition using advisory lock
CREATE OR REPLACE FUNCTION public.generate_personnel_payment_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_year TEXT;
  seq_number INTEGER;
  lock_key BIGINT := 987654321; -- Unique lock key for personnel payment numbers
BEGIN
  -- Acquire an advisory lock to prevent race conditions during concurrent inserts
  PERFORM pg_advisory_xact_lock(lock_key);
  
  current_year := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 5) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.personnel_payments
  WHERE number LIKE 'PAY-' || current_year || '%';
  RETURN 'PAY-' || current_year || LPAD(seq_number::TEXT, 5, '0');
END;
$function$;