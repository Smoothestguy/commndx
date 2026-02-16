INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-documents', 'vendor-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload vendor documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vendor-documents');

CREATE POLICY "Authenticated users can read vendor documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'vendor-documents');

CREATE POLICY "Authenticated users can delete vendor documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'vendor-documents');