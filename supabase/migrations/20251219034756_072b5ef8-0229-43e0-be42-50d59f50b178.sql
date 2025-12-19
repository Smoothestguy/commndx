-- Create storage bucket for application files (profile pictures, documents, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-files', 'application-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload files (public application form)
CREATE POLICY "Anyone can upload application files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'application-files');

-- Allow anyone to read application files
CREATE POLICY "Anyone can read application files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'application-files');

-- Allow authenticated users to delete application files
CREATE POLICY "Authenticated users can delete application files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'application-files' AND auth.role() = 'authenticated');