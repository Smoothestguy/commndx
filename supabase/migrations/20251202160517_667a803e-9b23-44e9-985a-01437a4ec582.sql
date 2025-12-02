-- Drop the partial index that doesn't work with ON CONFLICT
DROP INDEX IF EXISTS time_entries_personnel_entries_idx;

-- Create a regular unique constraint that works with ON CONFLICT
-- PostgreSQL treats NULLs as distinct, so this allows multiple rows with NULL personnel_id
ALTER TABLE time_entries 
ADD CONSTRAINT time_entries_personnel_project_date_unique 
UNIQUE (personnel_id, project_id, entry_date);