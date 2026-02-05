-- Add work_classification to personnel_project_assignments for WH-347 form
ALTER TABLE personnel_project_assignments 
ADD COLUMN work_classification TEXT;