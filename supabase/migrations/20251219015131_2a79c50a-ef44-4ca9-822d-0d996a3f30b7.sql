-- Add layout column for row-based layout storage
ALTER TABLE public.application_form_templates 
  ADD COLUMN IF NOT EXISTS layout jsonb DEFAULT '[]'::jsonb;

-- Add draft/publish workflow columns
ALTER TABLE public.application_form_templates 
  ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS published_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS published_version integer DEFAULT NULL;

-- Add form-level settings (redirect URL, access control, error display)
ALTER TABLE public.application_form_templates 
  ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;

-- Add index for finding published templates
CREATE INDEX IF NOT EXISTS idx_application_form_templates_is_draft 
  ON public.application_form_templates(is_draft);

-- Add index for finding templates by published version
CREATE INDEX IF NOT EXISTS idx_application_form_templates_published_version 
  ON public.application_form_templates(published_version);