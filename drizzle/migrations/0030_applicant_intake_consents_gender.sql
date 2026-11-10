ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male','female')),
  ADD COLUMN IF NOT EXISTS sms_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_consent_version text,
  ADD COLUMN IF NOT EXISTS photo_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS photo_consent_version text,
  ADD COLUMN IF NOT EXISTS background_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS background_consent_version text,
  ADD COLUMN IF NOT EXISTS consent_language text;

ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male','female')),
  ADD COLUMN IF NOT EXISTS sms_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_consent_version text,
  ADD COLUMN IF NOT EXISTS photo_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS photo_consent_version text,
  ADD COLUMN IF NOT EXISTS background_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS background_consent_version text;

-- Public intake: records consents/gender/photo for an application submitted in the last 30 minutes.
-- Only fills or adds proof; never clears existing consents.
CREATE OR REPLACE FUNCTION public.record_applicant_intake(
  _application_id uuid,
  _gender text DEFAULT NULL,
  _photo_url text DEFAULT NULL,
  _sms_consent boolean DEFAULT false,
  _sms_version text DEFAULT NULL,
  _photo_consent boolean DEFAULT false,
  _photo_version text DEFAULT NULL,
  _background_consent boolean DEFAULT false,
  _background_version text DEFAULT NULL,
  _language text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_applicant uuid;
BEGIN
  IF _gender IS NOT NULL AND _gender NOT IN ('male','female') THEN RAISE EXCEPTION 'invalid gender'; END IF;
  IF _photo_url IS NOT NULL AND (_photo_url !~ '^https://' OR length(_photo_url) > 2000) THEN RAISE EXCEPTION 'invalid photo'; END IF;
  IF _photo_url IS NOT NULL AND NOT _photo_consent THEN RAISE EXCEPTION 'photo consent required'; END IF;
  SELECT a.applicant_id INTO v_applicant FROM public.applications a
   WHERE a.id = _application_id
     AND greatest(coalesce(a.submitted_at,'epoch'), coalesce(a.updated_at,'epoch'), coalesce(a.created_at,'epoch')) > now() - interval '30 minutes';
  IF v_applicant IS NULL THEN RAISE EXCEPTION 'application not found or expired'; END IF;
  UPDATE public.applicants SET
    gender = coalesce(_gender, gender),
    photo_url = coalesce(_photo_url, photo_url),
    sms_consent_at = CASE WHEN _sms_consent THEN now() ELSE sms_consent_at END,
    sms_consent_version = CASE WHEN _sms_consent THEN left(_sms_version,40) ELSE sms_consent_version END,
    photo_consent_at = CASE WHEN _photo_consent THEN now() ELSE photo_consent_at END,
    photo_consent_version = CASE WHEN _photo_consent THEN left(_photo_version,40) ELSE photo_consent_version END,
    background_consent_at = CASE WHEN _background_consent THEN now() ELSE background_consent_at END,
    background_consent_version = CASE WHEN _background_consent THEN left(_background_version,40) ELSE background_consent_version END,
    consent_language = coalesce(left(_language,10), consent_language),
    updated_at = now()
  WHERE id = v_applicant;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_applicant_intake(uuid,text,text,boolean,text,boolean,text,boolean,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_applicant_intake(uuid,text,text,boolean,text,boolean,text,boolean,text,text) TO anon, authenticated, service_role;

-- Carry applicant photo/gender/consents to personnel when linked (fills blanks only).
CREATE OR REPLACE FUNCTION public.personnel_inherit_applicant_intake()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  IF NEW.applicant_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.applicant_id IS NOT DISTINCT FROM OLD.applicant_id THEN RETURN NEW; END IF;
  SELECT * INTO a FROM public.applicants WHERE id = NEW.applicant_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  NEW.gender := coalesce(NEW.gender, a.gender);
  NEW.photo_url := coalesce(NEW.photo_url, a.photo_url);
  IF NEW.sms_consent_at IS NULL THEN NEW.sms_consent_at := a.sms_consent_at; NEW.sms_consent_version := a.sms_consent_version; END IF;
  IF NEW.photo_consent_at IS NULL THEN NEW.photo_consent_at := a.photo_consent_at; NEW.photo_consent_version := a.photo_consent_version; END IF;
  IF NEW.background_consent_at IS NULL THEN NEW.background_consent_at := a.background_consent_at; NEW.background_consent_version := a.background_consent_version; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_personnel_inherit_applicant_intake ON public.personnel;
CREATE TRIGGER trg_personnel_inherit_applicant_intake BEFORE INSERT OR UPDATE OF applicant_id ON public.personnel
FOR EACH ROW EXECUTE FUNCTION public.personnel_inherit_applicant_intake();