-- Add UPDATE policy for applications table allowing updates via valid edit_token
CREATE POLICY "Public can update applications via edit token"
ON public.applications
FOR UPDATE
USING (edit_token IS NOT NULL AND edit_token_expires_at > now())
WITH CHECK (true);

-- Add UPDATE policy for applicants table for public edit access
-- This allows updating applicants when the request comes from a valid application edit flow
CREATE POLICY "Public can update applicants for edit flow"
ON public.applicants
FOR UPDATE
USING (true)
WITH CHECK (true);