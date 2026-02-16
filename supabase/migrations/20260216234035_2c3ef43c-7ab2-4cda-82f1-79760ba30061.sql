
-- 1. Add customer contact fields to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS customer_field_supervisor_name text,
  ADD COLUMN IF NOT EXISTS customer_field_supervisor_email text,
  ADD COLUMN IF NOT EXISTS customer_field_supervisor_phone text,
  ADD COLUMN IF NOT EXISTS customer_pm_name text,
  ADD COLUMN IF NOT EXISTS customer_pm_email text,
  ADD COLUMN IF NOT EXISTS customer_pm_phone text,
  ADD COLUMN IF NOT EXISTS our_field_superintendent_id uuid REFERENCES public.personnel(id);

-- 2. Add new enum values to change_order_status
ALTER TYPE public.change_order_status ADD VALUE IF NOT EXISTS 'pending_field_supervisor';
ALTER TYPE public.change_order_status ADD VALUE IF NOT EXISTS 'pending_customer_pm';
ALTER TYPE public.change_order_status ADD VALUE IF NOT EXISTS 'approved_pending_wo';

-- 3. Add workflow columns to change_orders
ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS work_authorized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_wo_number text,
  ADD COLUMN IF NOT EXISTS customer_wo_file_path text,
  ADD COLUMN IF NOT EXISTS customer_wo_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS field_supervisor_approval_token uuid,
  ADD COLUMN IF NOT EXISTS field_supervisor_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS field_supervisor_signature text,
  ADD COLUMN IF NOT EXISTS customer_pm_approval_token uuid,
  ADD COLUMN IF NOT EXISTS customer_pm_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_pm_signature text,
  ADD COLUMN IF NOT EXISTS sent_for_approval_at timestamptz,
  ADD COLUMN IF NOT EXISTS photos text[];

-- 4. Create change_order_approval_log table
CREATE TABLE IF NOT EXISTS public.change_order_approval_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id uuid NOT NULL REFERENCES public.change_orders(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_name text,
  actor_email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.change_order_approval_log ENABLE ROW LEVEL SECURITY;

-- Staff can SELECT approval logs
CREATE POLICY "Staff can view approval logs"
  ON public.change_order_approval_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'user')
  );

-- No direct INSERT from client — edge functions use service role
