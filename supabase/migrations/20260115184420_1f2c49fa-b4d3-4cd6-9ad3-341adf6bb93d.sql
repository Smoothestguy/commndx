-- Make sensitive storage buckets private
-- This is safe because all display components now use signed URLs

UPDATE storage.buckets 
SET public = false 
WHERE id IN ('personnel-photos', 'application-files', 'document-attachments');