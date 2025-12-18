-- Create the project_stage enum
CREATE TYPE project_stage AS ENUM ('quote', 'task_order', 'active', 'complete', 'canceled');

-- Add stage column to projects table (default to 'quote' for new projects)
ALTER TABLE projects 
ADD COLUMN stage project_stage NOT NULL DEFAULT 'quote';

-- Update existing projects to have appropriate stage based on status
UPDATE projects SET stage = 'active' WHERE status = 'active';
UPDATE projects SET stage = 'complete' WHERE status = 'completed';