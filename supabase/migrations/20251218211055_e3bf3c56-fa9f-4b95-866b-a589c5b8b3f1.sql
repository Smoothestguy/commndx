-- Allow public/anonymous users to select from applications table
-- This is needed for the duplicate application check during submission
CREATE POLICY "Public can select applications for duplicate check" 
ON public.applications
FOR SELECT 
TO public
USING (true);