-- Add new columns for theming, categories, and versioning to application_form_templates
ALTER TABLE public.application_form_templates 
  ADD COLUMN IF NOT EXISTS theme jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS success_message text DEFAULT 'Thank you for your submission!',
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- Add form_version to applications for historical tracking
ALTER TABLE public.applications 
  ADD COLUMN IF NOT EXISTS form_version integer DEFAULT 1;

-- Create storage bucket for form uploads if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-uploads', 'form-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for public uploads to form-uploads bucket
CREATE POLICY "Anyone can upload form files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'form-uploads');

-- Create storage policy for public read access
CREATE POLICY "Anyone can read form files"
ON storage.objects FOR SELECT
USING (bucket_id = 'form-uploads');