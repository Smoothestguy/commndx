
-- A. Fix the ALL policy with explicit WITH CHECK
DROP POLICY IF EXISTS "Admins and managers can manage applicants" ON applicants;
CREATE POLICY "Admins and managers can manage applicants" ON applicants
  FOR ALL TO public
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- B. Allow anon to SELECT applicants (for duplicate email check)
CREATE POLICY "Anon can check applicant by email" ON applicants
  FOR SELECT TO anon
  USING (true);

-- C. Allow anon to SELECT applications (for duplicate application check)
CREATE POLICY "Anon can check applications" ON applications
  FOR SELECT TO anon
  USING (true);
