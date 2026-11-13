DROP POLICY IF EXISTS "Public read field captures" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload application files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload form files" ON storage.objects;
CREATE POLICY "Staff read private intake files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN ('application-files','form-uploads') AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'user')));
CREATE POLICY "Staff upload private intake files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('application-files','form-uploads') AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'user')));
CREATE POLICY "Staff and owner read field captures" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='field-captures' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'user') OR owner_id=auth.uid()::text));
REVOKE SELECT ON public.vendors FROM anon;