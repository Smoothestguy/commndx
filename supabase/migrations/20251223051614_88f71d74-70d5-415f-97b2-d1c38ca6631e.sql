-- Add RLS policies for admins/managers to view session data

-- user_work_sessions: Allow admins/managers to view all sessions
CREATE POLICY "Admins can view all sessions" 
ON public.user_work_sessions FOR SELECT 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- session_activity_log: Allow admins/managers to view all activity logs
CREATE POLICY "Admins can view all activity logs" 
ON public.session_activity_log FOR SELECT 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- dev_activities: Allow admins/managers to view all dev activities
CREATE POLICY "Admins can view all dev activities" 
ON public.dev_activities FOR SELECT 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));