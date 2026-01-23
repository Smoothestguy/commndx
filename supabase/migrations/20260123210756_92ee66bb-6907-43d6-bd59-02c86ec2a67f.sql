-- Add contact tracking columns to applications table
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contacted_by UUID DEFAULT NULL;

-- Create application notes table for multi-user tracking
CREATE TABLE IF NOT EXISTS application_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE application_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for application_notes
CREATE POLICY "Authenticated users can read application notes" 
  ON application_notes FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can insert application notes" 
  ON application_notes FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" 
  ON application_notes FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" 
  ON application_notes FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_application_notes_application_id ON application_notes(application_id);

-- Create trigger for updated_at
CREATE TRIGGER update_application_notes_updated_at
  BEFORE UPDATE ON application_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();