
-- Create enum for contractor bill status
CREATE TYPE public.contractor_bill_status AS ENUM (
  'submitted',
  'field_verified',
  'pm_approved',
  'accounting_approved',
  'paid',
  'rejected'
);

-- Add billed_quantity column to room_scope_items
ALTER TABLE public.room_scope_items
ADD COLUMN billed_quantity numeric NOT NULL DEFAULT 0;

-- Add project_role to project_assignments for approval routing
ALTER TABLE public.project_assignments
ADD COLUMN project_role text;

-- Create contractor_completion_bills table
CREATE TABLE public.contractor_completion_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.project_rooms(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL DEFAULT 0,
  status public.contractor_bill_status NOT NULL DEFAULT 'submitted',
  rejection_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  verified_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  accounting_approved_at timestamptz,
  accounting_approved_by uuid REFERENCES public.profiles(id),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create contractor_completion_bill_items table
CREATE TABLE public.contractor_completion_bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.contractor_completion_bills(id) ON DELETE CASCADE,
  room_scope_item_id uuid NOT NULL REFERENCES public.room_scope_items(id) ON DELETE CASCADE,
  job_order_line_item_id uuid NOT NULL REFERENCES public.job_order_line_items(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contractor_completion_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_completion_bill_items ENABLE ROW LEVEL SECURITY;

-- RLS for contractor_completion_bills

-- Vendors can view their own bills
CREATE POLICY "Vendors can view own completion bills"
ON public.contractor_completion_bills
FOR SELECT
TO authenticated
USING (contractor_id = public.get_vendor_id_for_user(auth.uid()));

-- Vendors can insert completion bills for rooms assigned to them
CREATE POLICY "Vendors can submit completion bills"
ON public.contractor_completion_bills
FOR INSERT
TO authenticated
WITH CHECK (contractor_id = public.get_vendor_id_for_user(auth.uid()));

-- Staff (admin/manager) can view all completion bills
CREATE POLICY "Staff can view all completion bills"
ON public.contractor_completion_bills
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager')
);

-- Staff can update completion bills (for approval workflow)
CREATE POLICY "Staff can update completion bills"
ON public.contractor_completion_bills
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'accounting')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'accounting')
);

-- Accounting can view pm_approved bills
CREATE POLICY "Accounting can view approved completion bills"
ON public.contractor_completion_bills
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'accounting'));

-- RLS for contractor_completion_bill_items

-- Vendors can view their own bill items
CREATE POLICY "Vendors can view own completion bill items"
ON public.contractor_completion_bill_items
FOR SELECT
TO authenticated
USING (
  bill_id IN (
    SELECT id FROM public.contractor_completion_bills
    WHERE contractor_id = public.get_vendor_id_for_user(auth.uid())
  )
);

-- Vendors can insert bill items
CREATE POLICY "Vendors can insert completion bill items"
ON public.contractor_completion_bill_items
FOR INSERT
TO authenticated
WITH CHECK (
  bill_id IN (
    SELECT id FROM public.contractor_completion_bills
    WHERE contractor_id = public.get_vendor_id_for_user(auth.uid())
  )
);

-- Staff can view all bill items
CREATE POLICY "Staff can view all completion bill items"
ON public.contractor_completion_bill_items
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'accounting')
);

-- Trigger for updated_at
CREATE TRIGGER update_contractor_completion_bills_updated_at
BEFORE UPDATE ON public.contractor_completion_bills
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Validation trigger: prevent over-billing on room_scope_items
CREATE OR REPLACE FUNCTION public.validate_completion_bill_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_allocated numeric;
  v_already_billed numeric;
  v_available numeric;
BEGIN
  SELECT allocated_quantity, billed_quantity
  INTO v_allocated, v_already_billed
  FROM public.room_scope_items
  WHERE id = NEW.room_scope_item_id;

  IF v_allocated IS NULL THEN
    RAISE EXCEPTION 'Room scope item not found';
  END IF;

  v_available := v_allocated - v_already_billed;

  IF NEW.quantity > v_available THEN
    RAISE EXCEPTION 'Billed quantity (%) exceeds remaining balance (%) for this scope item',
      NEW.quantity, v_available;
  END IF;

  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than 0';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_completion_bill_item_trigger
BEFORE INSERT ON public.contractor_completion_bill_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_completion_bill_item();

-- Auto-update billed_quantity on room_scope_items when bill items are inserted
CREATE OR REPLACE FUNCTION public.update_room_scope_billed_quantity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_scope_item_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_scope_item_id := OLD.room_scope_item_id;
  ELSE
    v_scope_item_id := NEW.room_scope_item_id;
  END IF;

  UPDATE public.room_scope_items
  SET billed_quantity = COALESCE((
    SELECT SUM(quantity) FROM public.contractor_completion_bill_items
    WHERE room_scope_item_id = v_scope_item_id
  ), 0)
  WHERE id = v_scope_item_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER update_room_scope_billed_qty_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.contractor_completion_bill_items
FOR EACH ROW
EXECUTE FUNCTION public.update_room_scope_billed_quantity();
