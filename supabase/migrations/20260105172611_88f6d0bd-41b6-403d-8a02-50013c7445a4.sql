-- Add late_clock_in_attempt to clock_alerts alert_type
-- First drop the existing constraint if it exists
ALTER TABLE clock_alerts 
DROP CONSTRAINT IF EXISTS clock_alerts_alert_type_check;

-- Add the new constraint with late_clock_in_attempt
ALTER TABLE clock_alerts 
ADD CONSTRAINT clock_alerts_alert_type_check 
CHECK (alert_type IN ('missed_clock_in', 'auto_clock_out', 'geofence_violation', 'late_clock_in_attempt'));