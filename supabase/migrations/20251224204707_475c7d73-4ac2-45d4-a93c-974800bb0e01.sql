-- Make document-attachments bucket public for viewing receipts
UPDATE storage.buckets 
SET public = true 
WHERE id = 'document-attachments';