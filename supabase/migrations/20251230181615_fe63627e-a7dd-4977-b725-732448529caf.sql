-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Public can select applications for duplicate check" ON public.applications;

-- Create restricted SELECT policy - only admins/managers can view applications
CREATE POLICY "Admins and managers can view applications" 
ON public.applications 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);