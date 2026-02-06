-- Add locked period columns to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS locked_period_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS locked_period_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.company_settings.locked_period_date IS 
  'Cutoff date - transactions before this date cannot be created or modified';
COMMENT ON COLUMN public.company_settings.locked_period_enabled IS 
  'Whether locked period enforcement is active';

-- Create audit table for locked period violations
CREATE TABLE IF NOT EXISTS public.locked_period_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  attempted_date DATE NOT NULL,
  locked_period_date DATE NOT NULL,
  action TEXT NOT NULL,
  blocked BOOLEAN DEFAULT TRUE,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.locked_period_violations ENABLE ROW LEVEL SECURITY;

-- Only admins can view violations
CREATE POLICY "Admins can view locked period violations"
  ON public.locked_period_violations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert violations (for logging)
CREATE POLICY "Admins can insert locked period violations"
  ON public.locked_period_violations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_locked_period_violations_created_at 
  ON public.locked_period_violations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_locked_period_violations_entity 
  ON public.locked_period_violations(entity_type, entity_id);