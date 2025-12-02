-- Create product_categories table
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  item_type public.item_type NOT NULL DEFAULT 'product',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(name, item_type)
);

-- Enable RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins and managers can manage categories" ON public.product_categories 
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view categories" ON public.product_categories 
FOR SELECT USING (true);

-- Seed with default categories
INSERT INTO public.product_categories (name, item_type) VALUES
  ('Materials', 'product'),
  ('Roofing', 'product'),
  ('Accessories', 'product'),
  ('Consulting', 'service'),
  ('Inspections', 'service'),
  ('Installation', 'labor'),
  ('Repair', 'labor'),
  ('General Labor', 'labor');

-- Add updated_at trigger
CREATE TRIGGER update_product_categories_updated_at
BEFORE UPDATE ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();