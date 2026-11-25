ALTER TABLE public.punch_link_events DROP CONSTRAINT punch_link_events_visit_personnel_id_fkey;
ALTER TABLE public.punch_link_events ADD CONSTRAINT punch_link_events_visit_personnel_id_fkey FOREIGN KEY (visit_personnel_id) REFERENCES public.visit_personnel(id) ON DELETE SET NULL;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS voided_at timestamptz;
COMMENT ON COLUMN public.time_entries.voided_at IS 'Set when the source stay was removed; row kept at 0h for history and excluded from hours/billing/payroll.';
DROP INDEX IF EXISTS public.time_entries_personnel_project_date_nonvisit_unique;
CREATE UNIQUE INDEX time_entries_personnel_project_date_nonvisit_unique ON public.time_entries (personnel_id, project_id, entry_date) WHERE visit_personnel_id IS NULL AND voided_at IS NULL;