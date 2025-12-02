-- Drop existing unique constraint that causes issues with personnel entries
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_user_id_project_id_entry_date_key;

-- Create partial unique index for USER's own entries (no personnel attached)
CREATE UNIQUE INDEX time_entries_user_own_entries_idx 
ON time_entries (user_id, project_id, entry_date) 
WHERE personnel_id IS NULL;

-- Create partial unique index for PERSONNEL entries  
CREATE UNIQUE INDEX time_entries_personnel_entries_idx 
ON time_entries (personnel_id, project_id, entry_date) 
WHERE personnel_id IS NOT NULL;