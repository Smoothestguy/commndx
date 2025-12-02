-- Create product_units table
CREATE TABLE public.product_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins and managers can manage units" ON public.product_units FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view units" ON public.product_units FOR SELECT
  USING (true);

-- Seed with common units
INSERT INTO public.product_units (name) VALUES
  ('each'), ('hour'), ('day'), ('half day'), ('job'),
  ('bundle'), ('sq ft'), ('linear ft'), ('piece'),
  ('box'), ('roll'), ('gallon'), ('flat rate'), ('visit'), ('inspection');