-- Create audit_logs table for comprehensive activity tracking
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  action_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  resource_number text,
  changes_before jsonb,
  changes_after jsonb,
  ip_address text,
  user_agent text,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Indexes for common query patterns
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource_id ON public.audit_logs(resource_id);
CREATE INDEX idx_audit_logs_user_email ON public.audit_logs(user_email);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can view logs, no one can delete
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;