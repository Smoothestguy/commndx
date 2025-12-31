-- Add geofence columns to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS site_lat DOUBLE PRECISION;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS site_lng DOUBLE PRECISION;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS site_geocoded_at TIMESTAMPTZ;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS geofence_radius_miles NUMERIC DEFAULT 0.25;

-- Add auto-clock-out tracking columns to time_entries table
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS auto_clocked_out BOOLEAN DEFAULT false;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS auto_clock_out_reason TEXT;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS clock_blocked_until TIMESTAMPTZ;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS last_location_check_at TIMESTAMPTZ;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS last_location_lat DOUBLE PRECISION;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS last_location_lng DOUBLE PRECISION;

-- Create personnel_schedules table for tracking scheduled shifts
CREATE TABLE public.personnel_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_start_time TIME NOT NULL,
  scheduled_end_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(personnel_id, project_id, scheduled_date)
);

-- Enable RLS on personnel_schedules
ALTER TABLE public.personnel_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for personnel_schedules
CREATE POLICY "Admins and managers can manage schedules"
  ON public.personnel_schedules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Personnel can view their own schedules"
  ON public.personnel_schedules FOR SELECT
  USING (personnel_id = get_personnel_id_for_user(auth.uid()));

-- Create clock_alerts table for tracking sent alerts (avoid duplicates)
CREATE TABLE public.clock_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'missed_clock_in', 'auto_clock_out', 'geofence_violation'
  alert_date DATE NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on clock_alerts
ALTER TABLE public.clock_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for clock_alerts
CREATE POLICY "Admins and managers can manage clock alerts"
  ON public.clock_alerts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Personnel can view their own alerts"
  ON public.clock_alerts FOR SELECT
  USING (personnel_id = get_personnel_id_for_user(auth.uid()));

-- Create index for efficient queries
CREATE INDEX idx_personnel_schedules_date ON public.personnel_schedules(scheduled_date);
CREATE INDEX idx_personnel_schedules_personnel ON public.personnel_schedules(personnel_id);
CREATE INDEX idx_clock_alerts_date ON public.clock_alerts(alert_date);
CREATE INDEX idx_clock_alerts_type ON public.clock_alerts(alert_type);
CREATE INDEX idx_time_entries_blocked ON public.time_entries(clock_blocked_until) WHERE clock_blocked_until IS NOT NULL;

-- Add trigger for updated_at on personnel_schedules
CREATE TRIGGER update_personnel_schedules_updated_at
  BEFORE UPDATE ON public.personnel_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();