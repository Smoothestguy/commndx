-- Create table for user work sessions
CREATE TABLE public.user_work_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  session_start timestamptz NOT NULL DEFAULT now(),
  session_end timestamptz,
  total_active_seconds integer DEFAULT 0,
  total_idle_seconds integer DEFAULT 0,
  is_active boolean DEFAULT true,
  clock_in_type text DEFAULT 'auto',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create table for session activity log
CREATE TABLE public.session_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.user_work_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  activity_type text NOT NULL,
  route text,
  action_name text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_user_work_sessions_user_id ON public.user_work_sessions(user_id);
CREATE INDEX idx_user_work_sessions_is_active ON public.user_work_sessions(is_active);
CREATE INDEX idx_user_work_sessions_session_start ON public.user_work_sessions(session_start);
CREATE INDEX idx_session_activity_log_session_id ON public.session_activity_log(session_id);
CREATE INDEX idx_session_activity_log_user_id ON public.session_activity_log(user_id);
CREATE INDEX idx_session_activity_log_created_at ON public.session_activity_log(created_at);

-- Enable RLS
ALTER TABLE public.user_work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_work_sessions - users can only see/manage their own sessions
CREATE POLICY "Users can view their own sessions"
ON public.user_work_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
ON public.user_work_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
ON public.user_work_sessions FOR UPDATE
USING (auth.uid() = user_id);

-- RLS policies for session_activity_log - users can only see/manage their own activity
CREATE POLICY "Users can view their own activity logs"
ON public.session_activity_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity logs"
ON public.session_activity_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Trigger to update updated_at on user_work_sessions
CREATE TRIGGER update_user_work_sessions_updated_at
BEFORE UPDATE ON public.user_work_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();