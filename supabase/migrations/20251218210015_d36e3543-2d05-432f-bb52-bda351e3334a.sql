-- Allow public/anonymous users to select from applicants table
-- This is needed for the duplicate email check during application submission
CREATE POLICY "Public can select applicants by email" 
ON public.applicants
FOR SELECT 
TO public
USING (true);