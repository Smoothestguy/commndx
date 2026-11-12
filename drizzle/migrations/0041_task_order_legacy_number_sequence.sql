CREATE OR REPLACE FUNCTION public.task_order_number_and_edit_stamp() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE loc uuid; highest integer; supplied text;
BEGIN
 IF TG_TABLE_NAME='location_task_orders' THEN loc:=NEW.location_id; supplied:=NEW.to_number; ELSE loc:=NEW.event_location_id; supplied:=NEW.number; END IF;
 IF TG_OP='INSERT' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_NAME||loc::text,0));
  IF supplied IS NULL OR trim(supplied)='' THEN
   IF TG_TABLE_NAME='location_task_orders' THEN SELECT COALESCE(max(substring(to_number from '^(?:TO-)?([0-9]+)$')::integer),0) INTO highest FROM public.location_task_orders WHERE location_id=loc;
   ELSE SELECT COALESCE(max(substring(number from '^(?:TO-)?([0-9]+)$')::integer),0) INTO highest FROM public.event_task_orders WHERE event_location_id=loc; END IF;
   IF TG_TABLE_NAME='location_task_orders' THEN NEW.to_number:='TO-'||(highest+1); ELSE NEW.number:='TO-'||(highest+1); END IF;
  END IF;
 ELSE
  NEW.edited_by:=auth.uid(); NEW.edited_at:=clock_timestamp();
  IF NEW.edit_note IS NOT DISTINCT FROM OLD.edit_note THEN NEW.edit_note:='Edited order information'; END IF;
 END IF;
 RETURN NEW;
END $$;