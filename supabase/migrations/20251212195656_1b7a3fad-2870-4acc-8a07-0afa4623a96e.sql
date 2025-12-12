-- Create user_sensitive_permissions table for controlling access to sensitive financial data
CREATE TABLE public.user_sensitive_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  can_view_billing_rates BOOLEAN DEFAULT false,
  can_view_cost_rates BOOLEAN DEFAULT false,
  can_view_margins BOOLEAN DEFAULT false,
  can_view_personnel_pay_rates BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_sensitive_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins and managers can view/modify sensitive permissions
CREATE POLICY "Admins can manage sensitive permissions"
ON public.user_sensitive_permissions
FOR ALL
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
);

-- Users can view their own sensitive permissions
CREATE POLICY "Users can view own sensitive permissions"
ON public.user_sensitive_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_sensitive_permissions_updated_at
BEFORE UPDATE ON public.user_sensitive_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();