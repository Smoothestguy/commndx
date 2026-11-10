ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS on_bench boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bench_rank integer,
  ADD COLUMN IF NOT EXISTS bench_note text;
CREATE INDEX IF NOT EXISTS personnel_on_bench_idx ON public.personnel (on_bench) WHERE on_bench;
CREATE UNIQUE INDEX IF NOT EXISTS personnel_capabilities_person_label_uidx ON public.personnel_capabilities (personnel_id, lower(capability));

CREATE OR REPLACE FUNCTION public.guard_personnel_bench_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.on_bench IS DISTINCT FROM OLD.on_bench OR NEW.bench_rank IS DISTINCT FROM OLD.bench_rank OR NEW.bench_note IS DISTINCT FROM OLD.bench_note)
     AND auth.uid() IS NOT NULL
     AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Only managers can change bench status';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS personnel_bench_guard ON public.personnel;
CREATE TRIGGER personnel_bench_guard BEFORE UPDATE ON public.personnel FOR EACH ROW EXECUTE FUNCTION public.guard_personnel_bench_fields();

CREATE TABLE public.personnel_engagement_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.project_locations(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX personnel_engagement_notes_uidx ON public.personnel_engagement_notes (personnel_id, project_id, coalesce(location_id,'00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personnel_engagement_notes TO authenticated;
GRANT ALL ON public.personnel_engagement_notes TO service_role;
ALTER TABLE public.personnel_engagement_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage engagement notes" ON public.personnel_engagement_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));