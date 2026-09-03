DROP POLICY IF EXISTS "Authenticated staff can read ratings" ON public.personnel_assignment_ratings;
CREATE POLICY "Internal staff can read ratings"
  ON public.personnel_assignment_ratings FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'user')
    OR public.has_role(auth.uid(), 'accounting')
  );

DROP POLICY IF EXISTS "Authenticated staff can read applicant messages" ON public.applicant_messages;
CREATE POLICY "Internal staff can read applicant messages"
  ON public.applicant_messages FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'user')
    OR public.has_role(auth.uid(), 'accounting')
  );