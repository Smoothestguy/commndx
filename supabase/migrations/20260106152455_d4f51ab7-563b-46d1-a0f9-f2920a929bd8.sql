-- Create storage bucket for dashboard backgrounds
INSERT INTO storage.buckets (id, name, public)
VALUES ('dashboard-backgrounds', 'dashboard-backgrounds', true);

-- RLS policies for authenticated users to upload/manage their files
CREATE POLICY "Users can upload dashboard backgrounds"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dashboard-backgrounds' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their dashboard backgrounds"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'dashboard-backgrounds' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their dashboard backgrounds"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'dashboard-backgrounds' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can view dashboard backgrounds"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'dashboard-backgrounds');