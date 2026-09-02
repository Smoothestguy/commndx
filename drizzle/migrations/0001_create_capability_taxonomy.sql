CREATE TABLE public.capability_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  aliases text[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capability_categories TO authenticated;
GRANT ALL ON public.capability_categories TO service_role;

ALTER TABLE public.capability_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers manage capability categories"
ON public.capability_categories FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can read capability categories"
ON public.capability_categories FOR SELECT TO authenticated
USING (true);

CREATE TABLE public.applicant_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.capability_categories(id) ON DELETE CASCADE,
  years_experience int,
  confidence numeric(3,2),
  source text NOT NULL CHECK (source IN ('ai','self','admin','verified')),
  evidence text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (applicant_id, category_id)
);

CREATE INDEX idx_applicant_capabilities_category ON public.applicant_capabilities(category_id);
CREATE INDEX idx_applicant_capabilities_applicant ON public.applicant_capabilities(applicant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicant_capabilities TO authenticated;
GRANT ALL ON public.applicant_capabilities TO service_role;

ALTER TABLE public.applicant_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers manage applicant capabilities"
ON public.applicant_capabilities FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Staffing users can read applicant capabilities"
ON public.applicant_capabilities FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_permission(auth.uid(), 'staffing', 'view')
);

CREATE TRIGGER set_applicant_capabilities_updated_at
BEFORE UPDATE ON public.applicant_capabilities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS capabilities_classified_at timestamptz;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS capabilities_model text;

INSERT INTO public.capability_categories (slug, name, aliases, sort_order) VALUES
('general-labor','General Labor', ARRAY['laborer','cleanup','debris','helper','tank cleaner'],10),
('janitorial-housekeeping','Janitorial / Housekeeping', ARRAY['custodial','cleaning','restroom attendant','laundry','porter'],20),
('admin-clerical','Admin / Clerical', ARRAY['project admin','office','check-in','data entry','HR','payroll','receptionist','admin team','staff'],30),
('supervisor-foreman','Supervisor / Foreman', ARRAY['crew lead','site supervisor','superintendent','project manager'],40),
('kitchen-cook-chef','Kitchen: Cook / Chef', ARRAY['line cook','lead chef','prep cook','food prep'],50),
('kitchen-helper-server','Kitchen: Helper / Dishwasher / Server', ARRAY['food service','utility worker','kitchen staff','line server','dishwasher'],60),
('warehouse-logistics','Warehouse / Logistics', ARRAY['tool room','inventory','warehouse tech','receiving','material handler'],70),
('forklift-equipment-operator','Forklift / Heavy Equipment Operator', ARRAY['telehandler','skid steer','loader','excavator','bobcat'],80),
('driver-cdl','Driver: CDL', ARRAY['class A','class B','truck driver'],90),
('driver-non-cdl','Driver: Non-CDL', ARRAY['van','shuttle','pickup','delivery'],100),
('tent-event-structures','Tent / Event Structure Install', ARRAY['tent assembly','staging','event setup','teardown','clearspan'],110),
('roofing','Roofing', ARRAY['roofing tech','tile roof installer','shingles','metal roof'],120),
('carpentry-framing','Carpentry / Framing', ARRAY['carpenter','framer','drywall','finish'],130),
('electrical','Electrical', ARRAY['electrician','marine electrician','generator tech','low voltage'],140),
('plumbing-hvac','Plumbing / HVAC', ARRAY['plumber','pipefitter (non-marine)','HVAC tech','refrigeration'],150),
('welding-fitting','Welding / Fitting', ARRAY['welder','fitter','welder helper','fitter helper','burner','torch'],160),
('scaffold','Scaffold Builder', ARRAY['scaffolding','scaffold erector'],170),
('rigging-crane','Rigging / Crane', ARRAY['rigger','signal person','crane operator'],180),
('blasting-painting-coatings','Blasting / Painting / Coatings', ARRAY['sandblaster','industrial painter','coatings','spray'],190),
('insulation','Insulation', ARRAY['insulator','spray foam','fireproofing'],200),
('machinist-mechanic','Machinist / Mechanic', ARRAY['machinist','diesel mechanic','small engine','millwright'],210),
('fire-hole-watch','Fire Watch / Hole Watch / Confined Space Attendant', ARRAY['bottle watch','safety attendant','confined space'],220),
('safety-ehs','Safety / EHS', ARRAY['safety officer','safety tech','OSHA 30','HSE'],230),
('security','Security', ARRAY['guard','gate attendant','camp security'],240),
('field-tech-mot','Field Tech / Traffic Control (MOT)', ARRAY['flagger','traffic control','field technician','sign install'],250),
('landscaping-grounds','Landscaping / Grounds', ARRAY['lawn care','mowing','tree work','grounds keeper'],260),
('base-camp-support','Base Camp Support', ARRAY['camp attendant','bunk trailer','shower/laundry trailer','camp setup','disaster response'],270),
('medical-first-aid','Medical / First Aid', ARRAY['EMT','paramedic','nurse','medic'],280),
('it-av-comms','IT / AV / Communications', ARRAY['IT tech','AV','radios','starlink','network'],290),
('commercial-subcontractor','Commercial Subcontractor', ARRAY['licensed sub','GC','owns a company/crew'],300);