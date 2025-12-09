-- Create po_addendums table for storing change orders/addendums
CREATE TABLE public.po_addendums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add total_addendum_amount column to purchase_orders
ALTER TABLE public.purchase_orders 
ADD COLUMN total_addendum_amount NUMERIC NOT NULL DEFAULT 0;

-- Add total_cost column to projects table
ALTER TABLE public.projects 
ADD COLUMN total_cost NUMERIC NOT NULL DEFAULT 0;

-- Enable RLS on po_addendums
ALTER TABLE public.po_addendums ENABLE ROW LEVEL SECURITY;

-- RLS Policies for po_addendums
CREATE POLICY "Admins and managers can manage po_addendums"
ON public.po_addendums
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view po_addendums"
ON public.po_addendums
FOR SELECT
USING (true);

-- Function to update purchase_orders.total_addendum_amount when addendums change
CREATE OR REPLACE FUNCTION public.update_po_addendum_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_id uuid;
  v_total_addendums numeric;
BEGIN
  -- Get the purchase_order_id based on operation
  IF TG_OP = 'DELETE' THEN
    v_po_id := OLD.purchase_order_id;
  ELSE
    v_po_id := NEW.purchase_order_id;
  END IF;
  
  -- Calculate total addendum amount for the PO
  SELECT COALESCE(SUM(amount), 0) INTO v_total_addendums
  FROM public.po_addendums
  WHERE purchase_order_id = v_po_id;
  
  -- Update the purchase order
  UPDATE public.purchase_orders
  SET total_addendum_amount = v_total_addendums,
      updated_at = now()
  WHERE id = v_po_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger to update PO addendum totals
CREATE TRIGGER update_po_addendum_totals_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.po_addendums
FOR EACH ROW
EXECUTE FUNCTION public.update_po_addendum_totals();

-- Function to update project total_cost when PO totals change
CREATE OR REPLACE FUNCTION public.update_project_total_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_total_cost numeric;
BEGIN
  -- Get the project_id
  v_project_id := NEW.project_id;
  
  -- Calculate total cost from all POs for this project
  SELECT COALESCE(SUM(total + total_addendum_amount), 0) INTO v_total_cost
  FROM public.purchase_orders
  WHERE project_id = v_project_id;
  
  -- Update the project
  UPDATE public.projects
  SET total_cost = v_total_cost,
      updated_at = now()
  WHERE id = v_project_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to update project costs when PO changes
CREATE TRIGGER update_project_total_cost_trigger
AFTER INSERT OR UPDATE OF total, total_addendum_amount, project_id ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_project_total_cost();