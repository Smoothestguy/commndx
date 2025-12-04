-- Create user_permissions table for granular permissions
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  module text NOT NULL,
  can_view boolean DEFAULT false,
  can_add boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, module)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can manage all permissions
CREATE POLICY "Admins can manage permissions"
  ON public.user_permissions FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions"
  ON public.user_permissions FOR SELECT
  USING (auth.uid() = user_id);

-- Create helper function to check permissions
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid, 
  _module text, 
  _action text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE 
    WHEN has_role(_user_id, 'admin') THEN true
    WHEN has_role(_user_id, 'manager') THEN true
    ELSE COALESCE((
      SELECT CASE _action
        WHEN 'view' THEN can_view
        WHEN 'add' THEN can_add
        WHEN 'edit' THEN can_edit
        WHEN 'delete' THEN can_delete
        ELSE false
      END
      FROM public.user_permissions
      WHERE user_id = _user_id AND module = _module
    ), false)
  END
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();