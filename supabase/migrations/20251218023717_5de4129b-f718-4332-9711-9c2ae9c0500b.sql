-- Create enums for status tracking
CREATE TYPE public.task_order_status AS ENUM ('draft', 'open', 'filled', 'closed');
CREATE TYPE public.applicant_status AS ENUM ('new', 'approved', 'rejected', 'inactive');
CREATE TYPE public.application_status AS ENUM ('submitted', 'reviewing', 'approved', 'rejected');

-- Create project_task_orders table
CREATE TABLE public.project_task_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  job_description TEXT,
  headcount_needed INTEGER NOT NULL DEFAULT 1,
  start_at TIMESTAMPTZ,
  location_address TEXT,
  location_lat FLOAT8,
  location_lng FLOAT8,
  status task_order_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create job_postings table
CREATE TABLE public.job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_order_id UUID NOT NULL REFERENCES public.project_task_orders(id) ON DELETE CASCADE,
  public_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create applicants table
CREATE TABLE public.applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT UNIQUE NOT NULL,
  home_zip TEXT,
  home_lat FLOAT8,
  home_lng FLOAT8,
  status applicant_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create applications table
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  answers JSONB DEFAULT '{}'::jsonb,
  status application_status NOT NULL DEFAULT 'submitted',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add applicant_id to personnel table
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS applicant_id UUID REFERENCES public.applicants(id);

-- Enable RLS on all tables
ALTER TABLE public.project_task_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_task_orders (admin/manager only)
CREATE POLICY "Admins and managers can manage task orders"
  ON public.project_task_orders FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view task orders"
  ON public.project_task_orders FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for job_postings
CREATE POLICY "Admins and managers can manage job postings"
  ON public.job_postings FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Public can view open job postings by token"
  ON public.job_postings FOR SELECT
  USING (is_open = true);

-- RLS Policies for applicants (admin/manager only for reads)
CREATE POLICY "Admins and managers can manage applicants"
  ON public.applicants FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Public can insert applicants"
  ON public.applicants FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update own applicant by email"
  ON public.applicants FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- RLS Policies for applications
CREATE POLICY "Admins and managers can manage applications"
  ON public.applications FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Public can insert applications"
  ON public.applications FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_task_orders_project ON public.project_task_orders(project_id);
CREATE INDEX idx_task_orders_status ON public.project_task_orders(status);
CREATE INDEX idx_job_postings_token ON public.job_postings(public_token);
CREATE INDEX idx_job_postings_task_order ON public.job_postings(task_order_id);
CREATE INDEX idx_applicants_email ON public.applicants(email);
CREATE INDEX idx_applicants_status ON public.applicants(status);
CREATE INDEX idx_applications_posting ON public.applications(job_posting_id);
CREATE INDEX idx_applications_applicant ON public.applications(applicant_id);
CREATE INDEX idx_applications_status ON public.applications(status);
CREATE INDEX idx_personnel_applicant ON public.personnel(applicant_id);

-- Create updated_at triggers
CREATE TRIGGER update_project_task_orders_updated_at
  BEFORE UPDATE ON public.project_task_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_applicants_updated_at
  BEFORE UPDATE ON public.applicants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();