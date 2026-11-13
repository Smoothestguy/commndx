REVOKE ALL ON TABLE public.punch_link_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.punch_link_events TO authenticated;
GRANT ALL ON TABLE public.punch_link_events TO service_role;
COMMENT ON TABLE public.punch_link_events IS 'Manager-only GPS evidence of token-scoped page opens; public callers write only through record_punch_link_open, never direct table access.';