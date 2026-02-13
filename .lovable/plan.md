

## Fix: Duplicate Key Error When Creating Job Orders

### Problem
When creating a job order, the `generate_job_order_number()` database function sometimes generates a number that already exists, causing a "duplicate key value violates unique constraint 'job_orders_number_key'" error.

### Root Cause
The function uses `MAX()` to find the next sequence number but:
1. Has no advisory lock, so two concurrent inserts can get the same number
2. Does not account for soft-deleted job orders (rows with `deleted_at` set) that still occupy numbers in the table

### Solution
Update the `generate_job_order_number()` function to add a `pg_advisory_xact_lock` (same pattern already used by `generate_personnel_payment_number`). This prevents concurrent transactions from generating the same number.

### Technical Details

**Database migration** -- Replace the function:

```sql
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
```

The `pg_advisory_xact_lock` serializes all concurrent calls to this function within the same transaction scope, ensuring no two inserts generate the same number.

### Files to Modify

| File | Purpose |
|------|---------|
| Database migration (SQL) | Add advisory lock to `generate_job_order_number()` function |

No application code changes needed -- the function is called automatically by the existing `set_job_order_number` trigger.

