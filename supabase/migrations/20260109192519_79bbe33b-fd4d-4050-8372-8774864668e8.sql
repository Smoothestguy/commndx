-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Public can insert applicants" ON applicants;

-- Recreate as PERMISSIVE (default) so public users can insert
CREATE POLICY "Public can insert applicants"
ON applicants
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Add public SELECT policy for email lookup during submission
-- This allows checking if an applicant already exists by email
CREATE POLICY "Public can check applicant by email"
ON applicants
FOR SELECT
TO anon, authenticated
USING (true);