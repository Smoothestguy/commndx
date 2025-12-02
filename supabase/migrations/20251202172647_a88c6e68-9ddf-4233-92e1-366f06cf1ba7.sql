-- Create enums for roofing module
CREATE TYPE public.inspection_type AS ENUM ('initial', 'progress', 'final', 'warranty', 'storm_damage');
CREATE TYPE public.inspection_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.roof_condition AS ENUM ('excellent', 'good', 'fair', 'poor', 'critical');
CREATE TYPE public.roof_type AS ENUM ('gable', 'hip', 'flat', 'mansard', 'gambrel', 'shed', 'combination');
CREATE TYPE public.warranty_type AS ENUM ('manufacturer', 'workmanship', 'extended');
CREATE TYPE public.warranty_status AS ENUM ('active', 'expired', 'claimed', 'voided');

-- Create roof_inspections table
CREATE TABLE public.roof_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  inspector_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL,
  inspection_date DATE NOT NULL,
  inspection_type public.inspection_type NOT NULL DEFAULT 'initial',
  status public.inspection_status NOT NULL DEFAULT 'scheduled',
  overall_condition public.roof_condition,
  notes TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  findings JSONB DEFAULT '{}'::jsonb,
  recommendations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create roof_measurements table
CREATE TABLE public.roof_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_squares DECIMAL(10,2),
  pitch TEXT,
  roof_type public.roof_type,
  areas JSONB DEFAULT '[]'::jsonb,
  ridges_length DECIMAL(10,2),
  valleys_length DECIMAL(10,2),
  eaves_length DECIMAL(10,2),
  penetrations JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create roof_warranties table
CREATE TABLE public.roof_warranties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  warranty_type public.warranty_type NOT NULL DEFAULT 'manufacturer',
  provider TEXT NOT NULL,
  coverage_details TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status public.warranty_status NOT NULL DEFAULT 'active',
  warranty_number TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create weather_logs table
CREATE TABLE public.weather_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  temperature_high DECIMAL(5,2),
  temperature_low DECIMAL(5,2),
  precipitation DECIMAL(5,2),
  wind_speed DECIMAL(5,2),
  conditions TEXT,
  work_suitable BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.roof_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roof_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roof_warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for roof_inspections
CREATE POLICY "Admins and managers can manage roof inspections"
ON public.roof_inspections FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view roof inspections"
ON public.roof_inspections FOR SELECT
USING (true);

-- RLS policies for roof_measurements
CREATE POLICY "Admins and managers can manage roof measurements"
ON public.roof_measurements FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view roof measurements"
ON public.roof_measurements FOR SELECT
USING (true);

-- RLS policies for roof_warranties
CREATE POLICY "Admins and managers can manage roof warranties"
ON public.roof_warranties FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view roof warranties"
ON public.roof_warranties FOR SELECT
USING (true);

-- RLS policies for weather_logs
CREATE POLICY "Admins and managers can manage weather logs"
ON public.weather_logs FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can view weather logs"
ON public.weather_logs FOR SELECT
USING (true);

-- Add updated_at triggers
CREATE TRIGGER update_roof_inspections_updated_at
BEFORE UPDATE ON public.roof_inspections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_roof_measurements_updated_at
BEFORE UPDATE ON public.roof_measurements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_roof_warranties_updated_at
BEFORE UPDATE ON public.roof_warranties
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();