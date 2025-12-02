-- Create storage bucket for personnel documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('personnel-documents', 'personnel-documents', false);

-- Allow public uploads to pending folder
CREATE POLICY "Allow public upload to pending folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'personnel-documents' 
  AND (storage.foldername(name))[1] = 'pending'
);

-- Allow admins/managers to read all documents
CREATE POLICY "Admins can read personnel documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'personnel-documents'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
);

-- Allow admins/managers to delete documents
CREATE POLICY "Admins can delete personnel documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'personnel-documents'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
);

-- Create personnel_registrations table for pending submissions
CREATE TABLE public.personnel_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Personal Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  -- Address
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  -- Work Authorization
  work_authorization_type TEXT,
  work_auth_expiry DATE,
  ssn_last_four TEXT,
  -- Emergency Contacts (JSON array)
  emergency_contacts JSONB DEFAULT '[]',
  -- Documents (JSON array of storage paths)
  documents JSONB DEFAULT '[]',
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.personnel_registrations ENABLE ROW LEVEL SECURITY;

-- Public can insert (for self-registration)
CREATE POLICY "Anyone can submit registration"
ON public.personnel_registrations FOR INSERT
WITH CHECK (true);

-- Only admins/managers can view
CREATE POLICY "Admins and managers can view registrations"
ON public.personnel_registrations FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Only admins/managers can update
CREATE POLICY "Admins and managers can update registrations"
ON public.personnel_registrations FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Trigger for updated_at
CREATE TRIGGER update_personnel_registrations_updated_at
BEFORE UPDATE ON public.personnel_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();