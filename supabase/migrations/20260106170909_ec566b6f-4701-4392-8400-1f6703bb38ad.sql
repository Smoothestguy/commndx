-- Add payload column to messages table for storing message metadata
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.messages.payload IS 'JSONB column to store message-specific metadata like assignment IDs, project info, etc.';