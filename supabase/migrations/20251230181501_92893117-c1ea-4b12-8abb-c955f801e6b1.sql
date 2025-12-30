-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Public can select applicants by email" ON public.applicants;

-- Drop overly permissive UPDATE policies
DROP POLICY IF EXISTS "Public can update applicants for edit flow" ON public.applicants;
DROP POLICY IF EXISTS "Public can update own applicant by email" ON public.applicants;

-- Create restricted SELECT policy - only admins/managers can view applicants
-- (Public INSERT is kept for job application submissions)
CREATE POLICY "Admins and managers can view applicants" 
ON public.applicants 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Create restricted UPDATE policy - only admins/managers can update
CREATE POLICY "Admins and managers can update applicants" 
ON public.applicants 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);