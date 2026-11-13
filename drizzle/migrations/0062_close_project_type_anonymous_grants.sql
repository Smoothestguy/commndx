REVOKE ALL ON TABLE public.project_types FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.project_types TO authenticated;
GRANT ALL ON public.project_types TO service_role;