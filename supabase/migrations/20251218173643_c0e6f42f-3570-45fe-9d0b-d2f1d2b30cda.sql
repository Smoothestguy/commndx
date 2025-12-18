-- Fix vendor bill number race condition using PostgreSQL sequence (most robust approach)
-- Drop and recreate the function to use a sequence instead of MAX query

-- First, get the current max sequence number to initialize the sequence
DO $$
DECLARE
  max_seq INTEGER;
  current_year TEXT := TO_CHAR(NOW(), 'YY');
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 6) AS INTEGER)), 0)
  INTO max_seq
  FROM public.vendor_bills
  WHERE number LIKE 'BILL-' || current_year || '%';
  
  -- Drop sequence if exists
  DROP SEQUENCE IF EXISTS vendor_bill_number_seq;
  
  -- Create sequence starting from next number
  EXECUTE 'CREATE SEQUENCE vendor_bill_number_seq START WITH ' || (max_seq + 1);
END $$;

-- Update the function to use the sequence
CREATE OR REPLACE FUNCTION public.generate_vendor_bill_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_year TEXT;
  seq_number INTEGER;
  current_seq_year TEXT;
BEGIN
  current_year := TO_CHAR(NOW(), 'YY');
  
  -- Get next value from sequence
  seq_number := nextval('vendor_bill_number_seq');
  
  RETURN 'BILL-' || current_year || LPAD(seq_number::TEXT, 5, '0');
END;
$function$;

-- Create a function to reset sequence at year start (can be called manually or via cron)
CREATE OR REPLACE FUNCTION public.reset_vendor_bill_sequence_for_new_year()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_year TEXT := TO_CHAR(NOW(), 'YY');
  max_seq INTEGER;
BEGIN
  -- Get the max sequence for current year
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 6) AS INTEGER)), 0)
  INTO max_seq
  FROM public.vendor_bills
  WHERE number LIKE 'BILL-' || current_year || '%';
  
  -- Reset sequence to start after max
  PERFORM setval('vendor_bill_number_seq', GREATEST(max_seq, 0) + 1, false);
END;
$function$;