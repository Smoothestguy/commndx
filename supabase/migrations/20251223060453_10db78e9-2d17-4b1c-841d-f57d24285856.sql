-- Create storage bucket for form templates
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-templates',
  'form-templates',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow service role to access the bucket (edge functions use service role)
CREATE POLICY "Service role can read form templates"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'form-templates');