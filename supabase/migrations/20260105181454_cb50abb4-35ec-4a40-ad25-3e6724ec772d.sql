-- Drop existing permissive policies on personnel_invitations
DROP POLICY IF EXISTS "Anyone can read personnel_invitations" ON public.personnel_invitations;
DROP POLICY IF EXISTS "Public can read personnel_invitations" ON public.personnel_invitations;
DROP POLICY IF EXISTS "Authenticated users can view personnel_invitations" ON public.personnel_invitations;

-- Create restrictive policies - only admins/managers can view
CREATE POLICY "Admins and managers can view personnel_invitations"
ON public.personnel_invitations
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

-- Allow admins/managers to manage invitations
CREATE POLICY "Admins and managers can manage personnel_invitations"
ON public.personnel_invitations
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);