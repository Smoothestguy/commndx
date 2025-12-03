-- Add new columns to badge_templates table for enhanced editor
ALTER TABLE badge_templates
ADD COLUMN IF NOT EXISTS template_name TEXT,
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT 'Command X',
ADD COLUMN IF NOT EXISTS company_logo_url TEXT,
ADD COLUMN IF NOT EXISTS header_color TEXT DEFAULT '#1e40af',
ADD COLUMN IF NOT EXISTS show_photo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_personnel_number BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_phone BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_work_authorization BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_everify_status BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_certifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_capabilities BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_languages BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]'::jsonb;

-- Migrate existing 'name' data to 'template_name'
UPDATE badge_templates SET template_name = name WHERE template_name IS NULL;

-- Create logos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload logos
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

-- Allow public access to read logos
CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');

-- Allow authenticated users to update logos
CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'logos');

-- Allow authenticated users to delete logos
CREATE POLICY "Authenticated users can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'logos');