-- Drop the overly permissive policy that allows any authenticated user to view all personnel
DROP POLICY IF EXISTS "Authenticated users can view personnel" ON public.personnel;

-- Create a more restrictive SELECT policy:
-- Only admins, managers, or the personnel member themselves can view personnel records
CREATE POLICY "Admins managers and self can view personnel" 
ON public.personnel 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
  OR user_id = auth.uid()
);