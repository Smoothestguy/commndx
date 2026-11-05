ALTER POLICY "Admins and managers can manage project documents" ON public.project_documents TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));
ALTER POLICY "Authenticated users can view project documents" ON public.project_documents TO authenticated USING (true);
REVOKE ALL ON public.project_documents FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_documents TO authenticated;
GRANT ALL ON public.project_documents TO service_role;
ALTER POLICY "Authenticated users can view project documents" ON storage.objects TO authenticated USING (bucket_id = 'project-documents');