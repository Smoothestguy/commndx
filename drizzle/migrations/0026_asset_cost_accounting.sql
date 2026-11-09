ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS insurance_carrier text,
  ADD COLUMN IF NOT EXISTS insurance_policy_number text,
  ADD COLUMN IF NOT EXISTS insurance_expires_on date,
  ADD COLUMN IF NOT EXISTS insurance_annual_cost numeric CHECK (insurance_annual_cost IS NULL OR insurance_annual_cost >= 0),
  ADD COLUMN IF NOT EXISTS registration_annual_cost numeric CHECK (registration_annual_cost IS NULL OR registration_annual_cost >= 0),
  ADD COLUMN IF NOT EXISTS maintenance_annual_cost numeric CHECK (maintenance_annual_cost IS NULL OR maintenance_annual_cost >= 0),
  ADD COLUMN IF NOT EXISTS financing_annual_cost numeric CHECK (financing_annual_cost IS NULL OR financing_annual_cost >= 0),
  ADD COLUMN IF NOT EXISTS other_annual_cost numeric CHECK (other_annual_cost IS NULL OR other_annual_cost >= 0),
  ADD COLUMN IF NOT EXISTS other_annual_cost_note text,
  ADD COLUMN IF NOT EXISTS useful_life_years numeric NOT NULL DEFAULT 5 CHECK (useful_life_years > 0),
  ADD COLUMN IF NOT EXISTS salvage_value numeric NOT NULL DEFAULT 0 CHECK (salvage_value >= 0),
  ADD COLUMN IF NOT EXISTS daily_cost_override numeric CHECK (daily_cost_override IS NULL OR daily_cost_override >= 0),
  ADD COLUMN IF NOT EXISTS daily_cost_overridden boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.asset_catalog()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE money boolean; BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF; money := public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'); RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'type',a.type,'label',CASE WHEN a.asset_number IS NULL THEN a.label WHEN a.label=a.asset_number THEN a.label ELSE a.asset_number||' — '||a.label END,'raw_label',a.label,'asset_number',a.asset_number,'room_count',a.room_count,'description',a.description,'address',a.address,'gate_code',a.gate_code,'access_instructions',a.access_instructions,'operating_hours',a.operating_hours,'instructions',a.instructions,'serial_number',a.serial_number,'status',a.status,'ownership',a.ownership,'vendor_id',a.vendor_id,'vendor_name',v.name,'created_at',a.created_at,'updated_at',a.updated_at,'deleted_at',a.deleted_at) || CASE WHEN money THEN jsonb_build_object('default_day_rate',a.default_day_rate,'unit_cost',a.unit_cost,'rental_rate',a.rental_rate,'rental_period',a.rental_period,'notes',a.notes,'metadata',a.metadata,
 'insurance_carrier',a.insurance_carrier,'insurance_policy_number',a.insurance_policy_number,'insurance_expires_on',a.insurance_expires_on,'insurance_annual_cost',a.insurance_annual_cost,'registration_annual_cost',a.registration_annual_cost,'maintenance_annual_cost',a.maintenance_annual_cost,'financing_annual_cost',a.financing_annual_cost,'other_annual_cost',a.other_annual_cost,'other_annual_cost_note',a.other_annual_cost_note,'useful_life_years',a.useful_life_years,'salvage_value',a.salvage_value,'daily_cost_override',a.daily_cost_override,'daily_cost_overridden',a.daily_cost_overridden) ELSE '{}'::jsonb END ORDER BY a.label) FROM public.assets a LEFT JOIN public.vendors v ON v.id=a.vendor_id WHERE a.deleted_at IS NULL),'[]'::jsonb); END $function$;