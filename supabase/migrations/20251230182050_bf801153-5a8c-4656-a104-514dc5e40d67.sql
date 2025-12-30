-- Drop the admin-only view policy and replace with admin+manager
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create policy for admins and managers to view all profiles
CREATE POLICY "Admins and managers can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Add INSERT policy - only for authenticated users creating their own profile
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Add admin/manager management policy for full CRUD
CREATE POLICY "Admins and managers can manage profiles" 
ON public.profiles 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);