
-- Step 1: Re-sequence existing JO-26xxx numbers to proper format
WITH ranked AS (
  SELECT id, number,
    ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM job_orders
  WHERE number LIKE 'JO-26%'
)
UPDATE job_orders
SET number = 'JO-26' || LPAD(ranked.rn::TEXT, 5, '0')
FROM ranked
WHERE job_orders.id = ranked.id;

-- Step 2: Fix JO-25xxx numbers if they have the same issue
WITH ranked AS (
  SELECT id, number,
    ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM job_orders
  WHERE number LIKE 'JO-25%'
    AND LENGTH(number) > 10
)
UPDATE job_orders
SET number = 'JO-25' || LPAD(ranked.rn::TEXT, 5, '0')
FROM ranked
WHERE job_orders.id = ranked.id;

-- Step 3: Fix the generate_job_order_number function
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
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 6) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.job_orders
  WHERE number LIKE 'JO-' || current_year || '%'
    AND LENGTH(number) = 10;
  RETURN 'JO-' || current_year || LPAD(seq_number::TEXT, 5, '0');
END;
$$;

-- Step 4: Fix the same bug in generate_purchase_order_number (uses SUBSTRING FROM 4 too)
-- PO-YYNNNNN = 10 chars, sequence starts at position 6
CREATE OR REPLACE FUNCTION public.generate_purchase_order_number()
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  current_year TEXT;
  seq_number INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 6) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.purchase_orders
  WHERE number LIKE 'PO-' || current_year || '%'
    AND LENGTH(number) = 10;
  RETURN 'PO-' || current_year || LPAD(seq_number::TEXT, 5, '0');
END;
$$;
