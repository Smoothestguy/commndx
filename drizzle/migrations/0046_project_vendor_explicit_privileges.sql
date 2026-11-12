REVOKE ALL ON public.project_vendors FROM anon;
REVOKE DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.project_vendors FROM authenticated;
GRANT SELECT,INSERT,UPDATE ON public.project_vendors TO authenticated;
GRANT ALL ON public.project_vendors TO service_role;
REVOKE EXECUTE ON FUNCTION public.stamp_project_vendor() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_project_vendor() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_join_project_vendor() FROM PUBLIC,anon,authenticated;