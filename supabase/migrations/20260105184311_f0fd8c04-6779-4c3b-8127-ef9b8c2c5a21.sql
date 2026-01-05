-- Create dashboard_configurations table for storing user dashboard customizations
CREATE TABLE public.dashboard_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  layout JSONB NOT NULL DEFAULT '{"columns": 4, "widgets": []}',
  widgets JSONB NOT NULL DEFAULT '[]',
  theme JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_configurations_user_id_key UNIQUE (user_id)
);

-- Enable Row Level Security
ALTER TABLE public.dashboard_configurations ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own dashboard config
CREATE POLICY "Users can view their own dashboard configuration"
ON public.dashboard_configurations
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy for users to insert their own dashboard config
CREATE POLICY "Users can create their own dashboard configuration"
ON public.dashboard_configurations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own dashboard config
CREATE POLICY "Users can update their own dashboard configuration"
ON public.dashboard_configurations
FOR UPDATE
USING (auth.uid() = user_id);

-- Create policy for users to delete their own dashboard config
CREATE POLICY "Users can delete their own dashboard configuration"
ON public.dashboard_configurations
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_dashboard_configurations_updated_at
BEFORE UPDATE ON public.dashboard_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();