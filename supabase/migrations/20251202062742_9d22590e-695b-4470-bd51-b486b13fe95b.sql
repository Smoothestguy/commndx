-- Allow anyone to view invitations (needed for unauthenticated invitation acceptance)
CREATE POLICY "Anyone can view invitations by token"
ON public.invitations
FOR SELECT
USING (true);

-- Allow authenticated users to insert activity logs
CREATE POLICY "Authenticated users can insert activity logs"
ON public.invitation_activity_log
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);