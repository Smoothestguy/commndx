GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_id_for_user(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_personnel_id_for_user(uuid) TO anon;
COMMENT ON FUNCTION public.has_role(uuid,public.app_role) IS 'RLS helper: anonymous policies evaluate auth.uid() (NULL); not a privileged mutation entrypoint.';