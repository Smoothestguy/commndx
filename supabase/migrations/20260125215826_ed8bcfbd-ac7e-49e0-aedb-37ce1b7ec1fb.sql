-- Assets table for tracking equipment, vehicles, locations, badges, etc.
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'vehicle', 'equipment', 'location', 'key', 'badge', 'tool', 'device'
  label TEXT NOT NULL,
  description TEXT,
  address TEXT,
  gate_code TEXT, -- permission restricted (admin/manager only)
  access_instructions TEXT, -- permission restricted
  operating_hours TEXT,
  instructions TEXT,
  serial_number TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'maintenance', 'retired')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

-- Asset assignments linking assets to projects and optionally personnel
CREATE TABLE public.asset_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  assigned_to_personnel_id UUID REFERENCES public.personnel(id),
  assigned_by UUID REFERENCES auth.users(id),
  start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_at TIMESTAMPTZ,
  unassigned_at TIMESTAMPTZ,
  unassigned_by UUID REFERENCES auth.users(id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'transferred')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_assets_status ON assets(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_assets_deleted_at ON assets(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_asset_assignments_project ON asset_assignments(project_id);
CREATE INDEX idx_asset_assignments_asset ON asset_assignments(asset_id);
CREATE INDEX idx_asset_assignments_personnel ON asset_assignments(assigned_to_personnel_id);
CREATE INDEX idx_asset_assignments_status ON asset_assignments(status);

-- Trigger for updated_at
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_asset_assignments_updated_at
  BEFORE UPDATE ON asset_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assets
CREATE POLICY "Authenticated users can view non-deleted assets"
  ON public.assets FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Admin and Manager can insert assets"
  ON public.assets FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Admin and Manager can update assets"
  ON public.assets FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Admin can delete assets"
  ON public.assets FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for asset_assignments
CREATE POLICY "Authenticated users can view asset assignments"
  ON public.asset_assignments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin and Manager can insert asset assignments"
  ON public.asset_assignments FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Admin and Manager can update asset assignments"
  ON public.asset_assignments FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Admin can delete asset assignments"
  ON public.asset_assignments FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));