ALTER TABLE public.time_entries DROP CONSTRAINT check_entry_source;
ALTER TABLE public.time_entries ADD CONSTRAINT check_entry_source CHECK (entry_source IN ('manual','clock','admin_edit','visit','demobe'));
ALTER TABLE public.visit_personnel ADD COLUMN demobe_task_order_id uuid REFERENCES public.location_task_orders(id);
CREATE UNIQUE INDEX visit_personnel_demobe_order_person ON public.visit_personnel(demobe_task_order_id,personnel_id) WHERE demobe_task_order_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.validate_demobe_stay() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE o record; lid uuid;
BEGIN
 IF NEW.demobe_task_order_id IS NULL THEN RETURN NEW; END IF;
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Manager access required for demobe time'; END IF;
 SELECT location_id INTO lid FROM public.location_visits WHERE id=NEW.visit_id;
 SELECT * INTO o FROM public.location_task_orders WHERE id=NEW.demobe_task_order_id;
 IF NOT FOUND OR o.location_id IS DISTINCT FROM lid OR o.status <> 'accepted' OR o.kind NOT IN ('decrease','demobilization') THEN RAISE EXCEPTION 'Accepted same-location deductive task order required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_demobe_stay BEFORE INSERT OR UPDATE OF demobe_task_order_id ON public.visit_personnel FOR EACH ROW EXECUTE FUNCTION public.validate_demobe_stay();
CREATE OR REPLACE FUNCTION public.sync_visit_time_entry(p_vp uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s record; v_hours numeric;
BEGIN
 SELECT vp.id,vp.personnel_id,p.user_id AS person_user,p.non_billable,lv.location_id,pl.project_id,COALESCE(pl.timezone,'America/Chicago') AS tz,
 COALESCE(vp.checked_in_at,lv.check_in_at) AS in_at,COALESCE(vp.checked_out_at,lv.check_out_at) AS out_at,
 vp.demobe_task_order_id,o.to_number,o.travel_time
 INTO s FROM visit_personnel vp JOIN location_visits lv ON lv.id=vp.visit_id JOIN project_locations pl ON pl.id=lv.location_id JOIN personnel p ON p.id=vp.personnel_id
 LEFT JOIN location_task_orders o ON o.id=vp.demobe_task_order_id WHERE vp.id=p_vp;
 IF NOT FOUND OR s.out_at IS NULL OR s.in_at IS NULL OR s.out_at<=s.in_at THEN RETURN; END IF;
 v_hours:=ROUND((EXTRACT(epoch FROM s.out_at-s.in_at)/3600.0)::numeric,2);
 INSERT INTO time_entries(user_id,personnel_id,project_id,location_id,visit_personnel_id,entry_date,clock_in_at,clock_out_at,hours,regular_hours,entry_source,billable,status,description)
 VALUES(s.person_user,s.personnel_id,s.project_id,s.location_id,s.id,(s.in_at AT TIME ZONE s.tz)::date,s.in_at,s.out_at,v_hours,v_hours,
 CASE WHEN s.demobe_task_order_id IS NOT NULL THEN 'demobe' ELSE 'visit' END,NOT COALESCE(s.non_billable,false),'approved',
 CASE WHEN s.demobe_task_order_id IS NOT NULL THEN 'Demobe — TO '||s.to_number||' — travel time: '||CASE WHEN s.travel_time THEN 'included' WHEN s.travel_time=false THEN 'not included' ELSE 'unspecified' END ELSE 'Site visit (auto)' END)
 ON CONFLICT(visit_personnel_id) DO UPDATE SET clock_in_at=EXCLUDED.clock_in_at,clock_out_at=EXCLUDED.clock_out_at,hours=EXCLUDED.hours,regular_hours=EXCLUDED.regular_hours,entry_date=EXCLUDED.entry_date,location_id=EXCLUDED.location_id,billable=EXCLUDED.billable
 WHERE time_entries.is_locked IS DISTINCT FROM true;
END $$;