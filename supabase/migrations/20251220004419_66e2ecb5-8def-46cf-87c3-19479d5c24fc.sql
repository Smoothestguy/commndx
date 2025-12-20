-- Create dev_activities table for tracking development work
CREATE TABLE public.dev_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  activity_type text NOT NULL CHECK (activity_type IN ('git_commit', 'deployment', 'database_migration', 'schema_change', 'feature_development', 'bug_fix', 'code_review', 'configuration', 'testing', 'documentation', 'other')),
  title text NOT NULL,
  description text,
  duration_minutes integer,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  project_name text,
  technologies text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  extraction_confidence text DEFAULT 'medium' CHECK (extraction_confidence IN ('high', 'medium', 'low')),
  source_screenshot_url text,
  session_id uuid REFERENCES public.user_work_sessions(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE public.dev_activities ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own dev activities" 
ON public.dev_activities 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dev activities" 
ON public.dev_activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dev activities" 
ON public.dev_activities 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dev activities" 
ON public.dev_activities 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_dev_activities_user_id ON public.dev_activities(user_id);
CREATE INDEX idx_dev_activities_activity_date ON public.dev_activities(activity_date DESC);
CREATE INDEX idx_dev_activities_activity_type ON public.dev_activities(activity_type);
CREATE INDEX idx_dev_activities_project_name ON public.dev_activities(project_name);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_dev_activities_updated_at
BEFORE UPDATE ON public.dev_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();