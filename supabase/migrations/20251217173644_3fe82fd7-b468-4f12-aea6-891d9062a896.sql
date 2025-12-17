-- Create estimate_versions table to store version history
CREATE TABLE public.estimate_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  created_by_email TEXT,
  change_summary TEXT
);

-- Enable RLS
ALTER TABLE public.estimate_versions ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view estimate versions"
ON public.estimate_versions
FOR SELECT
USING (true);

CREATE POLICY "Users can create estimate versions"
ON public.estimate_versions
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_estimate_versions_estimate_id ON public.estimate_versions(estimate_id);
CREATE INDEX idx_estimate_versions_created_at ON public.estimate_versions(created_at DESC);