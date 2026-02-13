
-- Unit status enum
CREATE TYPE public.unit_status AS ENUM ('not_started', 'in_progress', 'complete', 'verified');

-- Project units table (rooms/units within a project)
CREATE TABLE public.project_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  unit_name TEXT,
  floor TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(project_id, unit_number)
);

-- Unit scope items (links a unit to a JO line item with specific quantity + contractor)
CREATE TABLE public.unit_scope_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES public.project_units(id) ON DELETE CASCADE,
  jo_line_item_id UUID NOT NULL REFERENCES public.job_order_line_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  assigned_vendor_id UUID REFERENCES public.vendors(id),
  status unit_status NOT NULL DEFAULT 'not_started',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(unit_id, jo_line_item_id)
);

-- Enable RLS
ALTER TABLE public.project_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_scope_items ENABLE ROW LEVEL SECURITY;

-- RLS for project_units: staff access (admins, managers, users)
CREATE POLICY "Staff can view project units"
  ON public.project_units FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'user')
  );

CREATE POLICY "Staff can insert project units"
  ON public.project_units FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'user')
  );

CREATE POLICY "Staff can update project units"
  ON public.project_units FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'user')
  );

CREATE POLICY "Staff can delete project units"
  ON public.project_units FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager')
  );

-- RLS for unit_scope_items: staff access
CREATE POLICY "Staff can view unit scope items"
  ON public.unit_scope_items FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'user')
  );

CREATE POLICY "Staff can insert unit scope items"
  ON public.unit_scope_items FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'user')
  );

CREATE POLICY "Staff can update unit scope items"
  ON public.unit_scope_items FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'user')
  );

CREATE POLICY "Staff can delete unit scope items"
  ON public.unit_scope_items FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager')
  );

-- Indexes for performance
CREATE INDEX idx_project_units_project_id ON public.project_units(project_id);
CREATE INDEX idx_unit_scope_items_unit_id ON public.unit_scope_items(unit_id);
CREATE INDEX idx_unit_scope_items_jo_line_item_id ON public.unit_scope_items(jo_line_item_id);
CREATE INDEX idx_unit_scope_items_assigned_vendor_id ON public.unit_scope_items(assigned_vendor_id);

-- Triggers for updated_at
CREATE TRIGGER update_project_units_updated_at
  BEFORE UPDATE ON public.project_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_unit_scope_items_updated_at
  BEFORE UPDATE ON public.unit_scope_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
