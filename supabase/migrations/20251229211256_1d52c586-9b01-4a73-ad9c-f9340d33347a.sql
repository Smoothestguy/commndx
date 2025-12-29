-- Create personnel record for Jorge Perez
INSERT INTO personnel (
  first_name,
  last_name,
  email,
  user_id,
  status
) VALUES (
  'Jorge',
  'Perez',
  'jperez@fairfieldgp.com',
  'f5ab2c60-78dd-4d65-b0a9-79a50bf49553',
  'active'
);

-- Migrate assignment from project_assignments to personnel_project_assignments
INSERT INTO personnel_project_assignments (
  project_id,
  personnel_id,
  assigned_by,
  assigned_at,
  status
)
SELECT 
  pa.project_id,
  p.id as personnel_id,
  pa.assigned_by,
  pa.assigned_at,
  'active'
FROM project_assignments pa
JOIN personnel p ON p.user_id = pa.user_id
WHERE pa.user_id = 'f5ab2c60-78dd-4d65-b0a9-79a50bf49553'
AND NOT EXISTS (
  SELECT 1 FROM personnel_project_assignments ppa 
  WHERE ppa.project_id = pa.project_id 
  AND ppa.personnel_id = p.id
);

-- Clean up old assignment from project_assignments
DELETE FROM project_assignments 
WHERE user_id = 'f5ab2c60-78dd-4d65-b0a9-79a50bf49553';