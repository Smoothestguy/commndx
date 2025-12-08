
-- Create contractor_submissions table
CREATE TABLE public.contractor_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_type TEXT NOT NULL CHECK (submission_type IN ('bill', 'expense')),
  contractor_name TEXT NOT NULL,
  -- Bill fields
  job_name TEXT,
  -- Expense fields
  customer_name TEXT,
  project_name TEXT,
  expense_description TEXT,
  amount NUMERIC,
  -- Common fields
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- File metadata (JSON array of file info)
  files JSONB DEFAULT '[]',
  -- Additional dynamic fields from form builder
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create contractor_form_configurations table
CREATE TABLE public.contractor_form_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type TEXT NOT NULL UNIQUE CHECK (form_type IN ('bill', 'expense')),
  fields JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contractor_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_form_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contractor_submissions
-- Anyone can insert (public submission)
CREATE POLICY "Anyone can submit contractor submissions"
ON public.contractor_submissions
FOR INSERT
WITH CHECK (true);

-- Only admins and managers can view submissions
CREATE POLICY "Admins and managers can view contractor submissions"
ON public.contractor_submissions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Only admins and managers can update/delete
CREATE POLICY "Admins and managers can manage contractor submissions"
ON public.contractor_submissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for form_configurations
-- Anyone can read form configs (contractors need to see form structure)
CREATE POLICY "Anyone can view form configurations"
ON public.contractor_form_configurations
FOR SELECT
USING (true);

-- Only admins can modify form configs
CREATE POLICY "Admins can manage form configurations"
ON public.contractor_form_configurations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for contractor submissions
INSERT INTO storage.buckets (id, name, public)
VALUES ('contractor-submissions', 'contractor-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for contractor-submissions bucket
-- Anyone can upload files (public submission)
CREATE POLICY "Anyone can upload contractor submission files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'contractor-submissions');

-- Only admins and managers can view/download files
CREATE POLICY "Admins and managers can view contractor files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'contractor-submissions' AND (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
));

-- Only admins and managers can delete files
CREATE POLICY "Admins and managers can delete contractor files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'contractor-submissions' AND (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
));

-- Seed initial form configurations
INSERT INTO public.contractor_form_configurations (form_type, fields) VALUES
('bill', '[
  {"id": "1", "name": "contractor_name", "label": "Your Name", "type": "text", "required": true, "order": 1},
  {"id": "2", "name": "job_name", "label": "Job / Project", "type": "project_select", "required": true, "order": 2},
  {"id": "3", "name": "submission_date", "label": "Date", "type": "date", "required": true, "order": 3},
  {"id": "4", "name": "files", "label": "Upload Files", "type": "file_upload", "required": true, "order": 4}
]'::jsonb),
('expense', '[
  {"id": "1", "name": "contractor_name", "label": "Your Name", "type": "text", "required": true, "order": 1},
  {"id": "2", "name": "customer_name", "label": "Customer", "type": "customer_select", "required": true, "order": 2},
  {"id": "3", "name": "project_name", "label": "Project Name", "type": "project_select", "required": true, "order": 3},
  {"id": "4", "name": "expense_description", "label": "What was this for?", "type": "textarea", "required": true, "order": 4},
  {"id": "5", "name": "amount", "label": "Receipt Amount", "type": "currency", "required": true, "order": 5},
  {"id": "6", "name": "submission_date", "label": "Date of Purchase", "type": "date", "required": true, "order": 6},
  {"id": "7", "name": "files", "label": "Upload Receipt", "type": "file_upload", "required": true, "order": 7}
]'::jsonb);

-- Add updated_at trigger
CREATE TRIGGER update_contractor_submissions_updated_at
BEFORE UPDATE ON public.contractor_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contractor_form_configurations_updated_at
BEFORE UPDATE ON public.contractor_form_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
