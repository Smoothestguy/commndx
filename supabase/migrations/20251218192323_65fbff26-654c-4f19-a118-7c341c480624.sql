-- Create application form templates table
CREATE TABLE public.application_form_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add form_template_id to job_postings
ALTER TABLE public.job_postings 
  ADD COLUMN form_template_id UUID REFERENCES public.application_form_templates(id);

-- Enable RLS
ALTER TABLE public.application_form_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for form templates
CREATE POLICY "Admins and managers can manage form templates"
  ON public.application_form_templates
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Public can view active form templates"
  ON public.application_form_templates
  FOR SELECT
  USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_application_form_templates_updated_at
  BEFORE UPDATE ON public.application_form_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert a default form template
INSERT INTO public.application_form_templates (name, description, fields, is_active)
VALUES (
  'Default Application Form',
  'Standard application form with basic questions',
  '[
    {"id": "years_experience", "type": "number", "label": "Years of Experience", "required": true, "placeholder": "Enter years"},
    {"id": "availability", "type": "dropdown", "label": "Availability", "required": true, "options": ["Immediate", "1 Week", "2 Weeks", "1 Month"]},
    {"id": "skills", "type": "textarea", "label": "Relevant Skills", "required": false, "placeholder": "Describe your relevant skills and experience"}
  ]'::jsonb,
  true
);