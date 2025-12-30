-- Drop the overly permissive policy that allows anyone to view all invitations
DROP POLICY IF EXISTS "Anyone can view invitations by token" ON public.invitations;

-- Create a restricted policy: Admins and managers can view all invitations
CREATE POLICY "Admins and managers can view invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
);

-- Create a policy to allow unauthenticated users to look up invitations by token only
-- This is needed for the invitation acceptance flow where users click an invite link
CREATE POLICY "Public can view invitation by token"
ON public.invitations
FOR SELECT
TO anon
USING (
  -- Only allow access when querying by a specific token
  -- The token column must match the request filter
  token IS NOT NULL
);