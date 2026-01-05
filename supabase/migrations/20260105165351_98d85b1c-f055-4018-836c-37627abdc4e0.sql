-- Add activity_time column to store the time of day when activity occurred
ALTER TABLE dev_activities 
ADD COLUMN activity_time TIME;

COMMENT ON COLUMN dev_activities.activity_time IS 'Time of day when the activity occurred (extracted from screenshot or manually entered)';