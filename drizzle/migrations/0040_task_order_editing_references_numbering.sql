ALTER TABLE public.location_task_orders ADD COLUMN customer_ref text, ADD COLUMN edited_by uuid, ADD COLUMN edited_at timestamptz, ADD COLUMN edit_note text;
ALTER TABLE public.event_task_orders ADD COLUMN customer_ref text, ADD COLUMN edited_by uuid, ADD COLUMN edited_at timestamptz, ADD COLUMN edit_note text, ADD COLUMN effective_time time, ADD COLUMN travel_time boolean, ADD COLUMN details jsonb, ADD COLUMN document_url text;
CREATE OR REPLACE FUNCTION public.task_order_number_and_edit_stamp() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE loc uuid; highest integer; old_number text; supplied text;
BEGIN
 IF TG_TABLE_NAME='location_task_orders' THEN loc:=NEW.location_id; supplied:=NEW.to_number; ELSE loc:=NEW.event_location_id; supplied:=NEW.number; END IF;
 IF TG_OP='INSERT' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_NAME||loc::text,0));
  IF supplied IS NULL OR trim(supplied)='' THEN
   IF TG_TABLE_NAME='location_task_orders' THEN SELECT COALESCE(max(substring(to_number from '^TO-([0-9]+)$')::integer),0) INTO highest FROM public.location_task_orders WHERE location_id=loc;
   ELSE SELECT COALESCE(max(substring(number from '^TO-([0-9]+)$')::integer),0) INTO highest FROM public.event_task_orders WHERE event_location_id=loc; END IF;
   IF TG_TABLE_NAME='location_task_orders' THEN NEW.to_number:='TO-'||(highest+1); ELSE NEW.number:='TO-'||(highest+1); END IF;
  END IF;
 ELSE
  NEW.edited_by:=auth.uid(); NEW.edited_at:=clock_timestamp();
  IF NEW.edit_note IS NOT DISTINCT FROM OLD.edit_note THEN NEW.edit_note:='Edited order information'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER task_order_number_edit BEFORE INSERT OR UPDATE ON public.location_task_orders FOR EACH ROW EXECUTE FUNCTION public.task_order_number_and_edit_stamp();
CREATE TRIGGER task_order_number_edit BEFORE INSERT OR UPDATE ON public.event_task_orders FOR EACH ROW EXECUTE FUNCTION public.task_order_number_and_edit_stamp();
CREATE OR REPLACE FUNCTION public.edit_location_task_order(p_id uuid,p_expected timestamptz,p_values jsonb,p_lines jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE old_order public.location_task_orders; item jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Only managers can edit task orders'; END IF;
 SELECT * INTO old_order FROM public.location_task_orders WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Task order unavailable'; END IF;
 IF old_order.edited_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Order changed. Reopen it before editing'; END IF;
 IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines)=0 THEN RAISE EXCEPTION 'Complete the authorization lines'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  IF item->>'line_kind' NOT IN ('asset','position') OR length(trim(item->>'label'))=0 OR (item->>'qty_delta')::integer=0 THEN RAISE EXCEPTION 'Invalid authorization line'; END IF;
 END LOOP;
 UPDATE public.location_task_orders SET to_number=p_values->>'to_number',kind=p_values->>'kind',effective_date=(p_values->>'effective_date')::date,effective_time=(p_values->>'effective_time')::time,travel_time=(p_values->>'travel_time')::boolean,details=p_values->'details',notes=p_values->>'notes',document_id=(p_values->>'document_id')::uuid,customer_ref=p_values->>'customer_ref',edit_note='Edited kind, effective date/time, quantities, travel, notes, document and customer reference' WHERE id=p_id;
 DELETE FROM public.location_task_order_lines WHERE task_order_id=p_id;
 INSERT INTO public.location_task_order_lines(task_order_id,line_kind,label,qty_delta) SELECT p_id,x.line_kind,x.label,x.qty_delta FROM jsonb_to_recordset(p_lines) AS x(line_kind text,label text,qty_delta integer);
 PERFORM public.sync_requirements_from_task_orders(old_order.location_id);
END $$;
REVOKE ALL ON FUNCTION public.edit_location_task_order(uuid,timestamptz,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edit_location_task_order(uuid,timestamptz,jsonb,jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_requirements_from_task_orders(uuid) FROM PUBLIC,anon;
