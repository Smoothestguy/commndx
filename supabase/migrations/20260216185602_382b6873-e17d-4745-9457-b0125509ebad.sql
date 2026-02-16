
-- Create enums for room/unit tracking
CREATE TYPE public.room_status AS ENUM ('not_started', 'in_progress', 'complete', 'verified');
CREATE TYPE public.room_scope_status AS ENUM ('pending', 'in_progress', 'complete', 'verified');

-- Create project_rooms table
CREATE TABLE public.project_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  unit_number text NOT NULL,
  floor_number integer,
  status public.room_status NOT NULL DEFAULT 'not_started',
  assigned_contractor_id uuid REFERENCES public.personnel(id),
  assigned_vendor_id uuid REFERENCES public.vendors(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on project + unit number
CREATE UNIQUE INDEX idx_project_rooms_project_unit ON public.project_rooms(project_id, unit_number);
CREATE INDEX idx_project_rooms_project_id ON public.project_rooms(project_id);

-- Create room_scope_items table
CREATE TABLE public.room_scope_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.project_rooms(id) ON DELETE CASCADE,
  job_order_line_item_id uuid NOT NULL REFERENCES public.job_order_line_items(id),
  allocated_quantity numeric NOT NULL,
  completed_quantity numeric NOT NULL DEFAULT 0,
  unit text,
  status public.room_scope_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_room_scope_items_room_id ON public.room_scope_items(room_id);
CREATE INDEX idx_room_scope_items_jo_line_item ON public.room_scope_items(job_order_line_item_id);

-- Auto-update updated_at triggers
CREATE TRIGGER update_project_rooms_updated_at
  BEFORE UPDATE ON public.project_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_room_scope_items_updated_at
  BEFORE UPDATE ON public.room_scope_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.project_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_scope_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_rooms (staff access pattern)
CREATE POLICY "Staff can view project rooms"
  ON public.project_rooms FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

CREATE POLICY "Staff can insert project rooms"
  ON public.project_rooms FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

CREATE POLICY "Staff can update project rooms"
  ON public.project_rooms FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

CREATE POLICY "Staff can delete project rooms"
  ON public.project_rooms FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

-- RLS Policies for room_scope_items (staff access pattern)
CREATE POLICY "Staff can view room scope items"
  ON public.room_scope_items FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

CREATE POLICY "Staff can insert room scope items"
  ON public.room_scope_items FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

CREATE POLICY "Staff can update room scope items"
  ON public.room_scope_items FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

CREATE POLICY "Staff can delete room scope items"
  ON public.room_scope_items FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'user')
  );

-- Validation trigger to prevent over-allocation
CREATE OR REPLACE FUNCTION public.validate_room_scope_allocation()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_jo_quantity numeric;
  v_already_allocated numeric;
  v_available numeric;
BEGIN
  -- Get the total quantity from the job order line item
  SELECT quantity INTO v_jo_quantity
  FROM public.job_order_line_items
  WHERE id = NEW.job_order_line_item_id;

  IF v_jo_quantity IS NULL THEN
    RAISE EXCEPTION 'Job order line item not found';
  END IF;

  -- Sum all existing allocations for this line item, excluding the current record on update
  SELECT COALESCE(SUM(allocated_quantity), 0) INTO v_already_allocated
  FROM public.room_scope_items
  WHERE job_order_line_item_id = NEW.job_order_line_item_id
    AND id IS DISTINCT FROM NEW.id;

  v_available := v_jo_quantity - v_already_allocated;

  IF NEW.allocated_quantity > v_available THEN
    RAISE EXCEPTION 'Allocated quantity (%) exceeds remaining balance (%) for this line item',
      NEW.allocated_quantity, v_available;
  END IF;

  IF NEW.allocated_quantity <= 0 THEN
    RAISE EXCEPTION 'Allocated quantity must be greater than 0';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_room_scope_allocation_trigger
  BEFORE INSERT OR UPDATE ON public.room_scope_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_room_scope_allocation();
