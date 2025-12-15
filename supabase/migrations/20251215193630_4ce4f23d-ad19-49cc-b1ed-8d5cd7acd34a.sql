-- Migrate existing project_assignments to personnel_project_assignments
-- for users who have linked personnel records
INSERT INTO personnel_project_assignments (project_id, personnel_id, status, assigned_at, assigned_by)
SELECT 
  pa.project_id,
  p.id as personnel_id,
  pa.status,
  pa.assigned_at,
  pa.assigned_by
FROM project_assignments pa
JOIN personnel p ON p.user_id = pa.user_id
WHERE pa.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM personnel_project_assignments ppa 
    WHERE ppa.project_id = pa.project_id 
      AND ppa.personnel_id = p.id
  );