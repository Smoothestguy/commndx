-- Add hourly_rate column to time_entries to snapshot pay rate at entry time
ALTER TABLE time_entries 
ADD COLUMN hourly_rate numeric DEFAULT NULL;

-- Backfill locked entries with current personnel rates
-- This preserves historical data for already-closed weeks
UPDATE time_entries te
SET hourly_rate = p.pay_rate
FROM personnel p
WHERE te.personnel_id = p.id
AND te.is_locked = true
AND te.hourly_rate IS NULL;