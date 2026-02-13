CREATE OR REPLACE FUNCTION public.generate_job_order_number()
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  current_year TEXT;
  seq_number INTEGER;
  lock_key BIGINT := 123456789;
BEGIN
  PERFORM pg_advisory_xact_lock(lock_key);

  current_year := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 4) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.job_orders
  WHERE number LIKE 'JO-' || current_year || '%';
  RETURN 'JO-' || current_year || LPAD(seq_number::TEXT, 5, '0');
END;
$$;