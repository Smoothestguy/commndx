-- Fix vendor_bill_number_seq initialization/parsing: only parse the 5-digit sequence part
-- Format is: BILL-YYNNNNN, so the numeric sequence starts at position 8

-- 1) Update the reset function to parse correctly
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
  -- Extract ONLY the 5-digit sequence (NNNNN) after 'BILL-YY'
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 8) AS INTEGER)), 0)
  INTO max_seq
  FROM public.vendor_bills
  WHERE number LIKE 'BILL-' || current_year || '%'
    AND length(number) >= 12; -- 'BILL-'(5) + YY(2) + NNNNN(5) = 12

  -- Reset sequence to start after max
  PERFORM setval('vendor_bill_number_seq', GREATEST(max_seq, 0) + 1, false);
END;
$function$;

-- 2) Immediately reset the sequence now using the corrected parsing
DO $$
DECLARE
  current_year TEXT := TO_CHAR(NOW(), 'YY');
  max_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 8) AS INTEGER)), 0)
  INTO max_seq
  FROM public.vendor_bills
  WHERE number LIKE 'BILL-' || current_year || '%'
    AND length(number) >= 12;

  PERFORM setval('vendor_bill_number_seq', GREATEST(max_seq, 0) + 1, false);
END $$;