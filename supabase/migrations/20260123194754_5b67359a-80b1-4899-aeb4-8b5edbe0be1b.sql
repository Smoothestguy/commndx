-- Make application-files bucket public so getPublicUrl() works for applicant profile photos
UPDATE storage.buckets 
SET public = true 
WHERE id = 'application-files';