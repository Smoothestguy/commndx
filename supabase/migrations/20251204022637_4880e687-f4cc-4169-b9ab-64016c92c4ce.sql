-- Add 'personnel' role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'personnel';

-- Add user_id column to personnel table to link with auth users
ALTER TABLE public.personnel 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE;

-- Create reimbursements table
CREATE TABLE IF NOT EXISTS public.reimbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  receipt_url text,
  status text NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create personnel_notifications table
CREATE TABLE IF NOT EXISTS public.personnel_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL DEFAULT 'general',
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create personnel_notification_preferences table
CREATE TABLE IF NOT EXISTS public.personnel_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE UNIQUE,
  email_notifications boolean DEFAULT true,
  sms_notifications boolean DEFAULT false,
  job_alerts boolean DEFAULT true,
  pay_notifications boolean DEFAULT true,
  assignment_notifications boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create personnel_invitations table
CREATE TABLE IF NOT EXISTS public.personnel_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(personnel_id, status)
);

-- Enable RLS on all new tables
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_invitations ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is linked personnel
CREATE OR REPLACE FUNCTION public.get_personnel_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.personnel WHERE user_id = _user_id LIMIT 1
$$;

-- Create helper function to check if user has personnel role
CREATE OR REPLACE FUNCTION public.is_personnel(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personnel WHERE user_id = _user_id
  )
$$;

-- RLS Policies for reimbursements
CREATE POLICY "Admins and managers can manage all reimbursements"
ON public.reimbursements FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Personnel can view own reimbursements"
ON public.reimbursements FOR SELECT
USING (personnel_id = public.get_personnel_id_for_user(auth.uid()));

CREATE POLICY "Personnel can insert own reimbursements"
ON public.reimbursements FOR INSERT
WITH CHECK (personnel_id = public.get_personnel_id_for_user(auth.uid()));

CREATE POLICY "Personnel can update own pending reimbursements"
ON public.reimbursements FOR UPDATE
USING (personnel_id = public.get_personnel_id_for_user(auth.uid()) AND status = 'pending');

-- RLS Policies for personnel_notifications
CREATE POLICY "Admins and managers can manage all notifications"
ON public.personnel_notifications FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Personnel can view own notifications"
ON public.personnel_notifications FOR SELECT
USING (personnel_id = public.get_personnel_id_for_user(auth.uid()));

CREATE POLICY "Personnel can update own notifications"
ON public.personnel_notifications FOR UPDATE
USING (personnel_id = public.get_personnel_id_for_user(auth.uid()));

-- RLS Policies for personnel_notification_preferences
CREATE POLICY "Admins and managers can manage all preferences"
ON public.personnel_notification_preferences FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Personnel can view own preferences"
ON public.personnel_notification_preferences FOR SELECT
USING (personnel_id = public.get_personnel_id_for_user(auth.uid()));

CREATE POLICY "Personnel can manage own preferences"
ON public.personnel_notification_preferences FOR ALL
USING (personnel_id = public.get_personnel_id_for_user(auth.uid()));

-- RLS Policies for personnel_invitations
CREATE POLICY "Admins and managers can manage invitations"
ON public.personnel_invitations FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Anyone can view invitations by token"
ON public.personnel_invitations FOR SELECT
USING (true);

-- Add policy for personnel to view their own time entries
CREATE POLICY "Personnel can view own time entries"
ON public.time_entries FOR SELECT
USING (personnel_id = public.get_personnel_id_for_user(auth.uid()));

-- Add policy for personnel to view their own project assignments
CREATE POLICY "Personnel can view own project assignments"
ON public.personnel_project_assignments FOR SELECT
USING (personnel_id = public.get_personnel_id_for_user(auth.uid()));

-- Add policy for personnel to view their own personnel record
CREATE POLICY "Personnel can view own record"
ON public.personnel FOR SELECT
USING (user_id = auth.uid());

-- Add policy for personnel to view projects they're assigned to
CREATE POLICY "Personnel can view assigned projects"
ON public.projects FOR SELECT
USING (
  id IN (
    SELECT project_id FROM public.personnel_project_assignments 
    WHERE personnel_id = public.get_personnel_id_for_user(auth.uid())
    AND status = 'active'
  )
);

-- Create trigger for updated_at on reimbursements
CREATE TRIGGER update_reimbursements_updated_at
BEFORE UPDATE ON public.reimbursements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on personnel_notification_preferences
CREATE TRIGGER update_personnel_notification_preferences_updated_at
BEFORE UPDATE ON public.personnel_notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();