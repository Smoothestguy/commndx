-- Create storage bucket for document attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('document-attachments', 'document-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for document-attachments bucket
CREATE POLICY "Authenticated users can upload document attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'document-attachments');

CREATE POLICY "Authenticated users can view document attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'document-attachments');

CREATE POLICY "Admins and managers can delete document attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'document-attachments' AND (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
));

-- Create invoice_attachments table
CREATE TABLE public.invoice_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.invoice_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view invoice attachments"
ON public.invoice_attachments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and managers can manage invoice attachments"
ON public.invoice_attachments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Create estimate_attachments table
CREATE TABLE public.estimate_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.estimate_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view estimate attachments"
ON public.estimate_attachments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and managers can manage estimate attachments"
ON public.estimate_attachments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Create vendor_bill_attachments table
CREATE TABLE public.vendor_bill_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.vendor_bills(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.vendor_bill_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vendor bill attachments"
ON public.vendor_bill_attachments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and managers can manage vendor bill attachments"
ON public.vendor_bill_attachments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));