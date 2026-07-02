
-- Hardening for public application submit path.
-- 1) SECURITY DEFINER RPC so anon submitters can persist geocoded coordinates
--    without needing SELECT/UPDATE on public.applicants.
CREATE OR REPLACE FUNCTION public.update_applicant_geo(
  _applicant_id uuid,
  _lat double precision,
  _lng double precision,
  _is_geocodable boolean,
  _geocode_source text DEFAULT 'mapbox_submission'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _applicant_id IS NULL THEN
    RAISE EXCEPTION 'applicant_id is required';
  END IF;

  IF _lat IS NOT NULL AND _lng IS NOT NULL THEN
    UPDATE public.applicants
    SET home_lat = _lat,
        home_lng = _lng,
        geocoded_at = now(),
        geocode_source = _geocode_source,
        is_geocodable = true
    WHERE id = _applicant_id
      AND (home_lat IS NULL OR home_lng IS NULL);
  ELSE
    UPDATE public.applicants
    SET is_geocodable = COALESCE(_is_geocodable, false)
    WHERE id = _applicant_id
      AND (home_lat IS NULL OR home_lng IS NULL);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_applicant_geo(uuid, double precision, double precision, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_applicant_geo(uuid, double precision, double precision, boolean, text) TO anon, authenticated, service_role;

-- 2) Consistency grants on application_attempts. The SECURITY DEFINER writer
--    (save_application_attempt) already works, but explicit grants avoid a
--    footgun if the RPC is ever changed to SECURITY INVOKER.
GRANT INSERT, UPDATE ON public.application_attempts TO anon, authenticated;
GRANT ALL ON public.application_attempts TO service_role;
