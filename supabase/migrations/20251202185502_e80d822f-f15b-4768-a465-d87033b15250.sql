CREATE OR REPLACE FUNCTION public.generate_personnel_number()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  current_year TEXT;
  seq_number INTEGER;
  new_number TEXT;
BEGIN
  current_year := TO_CHAR(NOW(), 'YY');
  
  -- Fixed: Changed FROM 4 to FROM 5 to correctly extract the 5-digit sequence
  -- Format is P-YYNNNNN where sequence starts at position 5
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(personnel_number FROM 5 FOR 5) AS INTEGER)
  ), 0) + 1
  INTO seq_number
  FROM public.personnel
  WHERE personnel_number LIKE 'P-' || current_year || '%';
  
  new_number := 'P-' || current_year || LPAD(seq_number::TEXT, 5, '0');
  RETURN new_number;
END;
$function$;