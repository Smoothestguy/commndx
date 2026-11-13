CREATE OR REPLACE FUNCTION public.get_vendor_onboarding_info(p_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE t record; v record; BEGIN
 IF p_token IS NULL OR length(p_token)<16 OR length(p_token)>200 THEN RETURN jsonb_build_object('status','not_found'); END IF;
 SELECT id,vendor_id,expires_at,used_at,created_at INTO t FROM public.vendor_onboarding_tokens WHERE token=p_token;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
 IF t.used_at IS NOT NULL THEN RETURN jsonb_build_object('status','used'); END IF;
 IF t.expires_at<=now() THEN RETURN jsonb_build_object('status','expired'); END IF;
 SELECT id,name,company,email,phone,contact_name,contact_title,business_type,years_in_business,website,specialty,license_number,address,city,state,zip,payment_terms,insurance_expiry,onboarding_status INTO v FROM public.vendors WHERE id=t.vendor_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
 RETURN jsonb_build_object('status','valid','token',jsonb_build_object('id',t.id,'vendor_id',t.vendor_id,'expires_at',t.expires_at,'used_at',t.used_at,'created_at',t.created_at),'vendor',to_jsonb(v));
END $$;
REVOKE ALL ON FUNCTION public.get_vendor_onboarding_info(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_vendor_onboarding_info(text) TO anon,authenticated,service_role;
DROP POLICY IF EXISTS "Anon can read vendor during onboarding" ON public.vendors;
REVOKE SELECT ON public.vendors,public.vendor_onboarding_tokens FROM anon;
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname,tablename,qual FROM pg_policies WHERE schemaname='public' AND cmd='ALL' AND with_check IS NULL AND qual IS NOT NULL LOOP
 EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)',p.policyname,p.tablename,p.qual);
 END LOOP;
END $$;