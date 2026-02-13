

## Fix: Snowballing Job Order Numbers

### Problem
The `generate_job_order_number()` function has a **parsing bug** that causes numbers to snowball. Current data shows numbers like `JO-2626262`, `JO-2626260`, `JO-2626000` instead of the intended `JO-26NNNNN` format.

### Root Cause
The function uses `SUBSTRING(number FROM 4)` to extract the sequence number. This skips only `JO-` (3 characters) but leaves the 2-digit year prefix attached:

```
JO-2600001 → SUBSTRING FROM 4 → "2600001" → integer 2600001
```

So `MAX(2600001) + 1 = 2600002`, then formatted as `JO-26` + `LPAD(2600002, 5, '0')` = `JO-262600002` (LPAD does not truncate, only pads). Each generation produces a longer number, and the MAX keeps climbing.

The correct extraction should start at position 6 to skip `JO-YY`:

```
JO-2600001 → SUBSTRING FROM 6 → "00001" → integer 1
```

### Solution

**Database migration** -- fix the function and clean up existing bad data:

1. **Update existing malformed numbers** to the correct `JO-26NNNNN` format by re-sequencing them
2. **Fix the function** to use `SUBSTRING(number FROM 6)` instead of `SUBSTRING(number FROM 4)`

### Technical Details

```sql
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

-- Step 2: Also fix JO-25xxx numbers if they have the same issue
WITH ranked AS (
  SELECT id, number,
    ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM job_orders
  WHERE number LIKE 'JO-25%'
    AND number != 'JO-2500001'
    AND LENGTH(number) > 10
)
UPDATE job_orders
SET number = 'JO-25' || LPAD(ranked.rn::TEXT, 5, '0')
FROM ranked
WHERE job_orders.id = ranked.id;

-- Step 3: Fix the function
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
  -- Extract only the 5-digit sequence AFTER 'JO-YY' (position 6 onward)
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 6) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.job_orders
  WHERE number LIKE 'JO-' || current_year || '%'
    AND LENGTH(number) = 10;  -- Only match properly formatted numbers (JO-YYNNNNN)
  RETURN 'JO-' || current_year || LPAD(seq_number::TEXT, 5, '0');
END;
$$;
```

### Files to Modify

| File | Change |
|------|--------|
| Database migration (SQL) | Fix substring offset, add LENGTH guard, clean up existing bad numbers |

No application code changes needed.
