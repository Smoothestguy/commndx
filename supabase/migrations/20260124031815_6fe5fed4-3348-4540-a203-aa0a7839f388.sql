-- Add message status tracking columns to conversation_messages
ALTER TABLE public.conversation_messages 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed'));

ALTER TABLE public.conversation_messages 
ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.conversation_messages 
ADD COLUMN IF NOT EXISTS error_code TEXT;

ALTER TABLE public.conversation_messages 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

ALTER TABLE public.conversation_messages 
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

-- Add priority and escalation columns to admin_notifications
ALTER TABLE public.admin_notifications 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('critical', 'high', 'normal', 'low'));

ALTER TABLE public.admin_notifications 
ADD COLUMN IF NOT EXISTS escalation_count INTEGER DEFAULT 0;

ALTER TABLE public.admin_notifications 
ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

ALTER TABLE public.admin_notifications 
ADD COLUMN IF NOT EXISTS group_key TEXT;

ALTER TABLE public.admin_notifications 
ADD COLUMN IF NOT EXISTS count INTEGER DEFAULT 1;

-- Create push_tokens table for push notifications
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Enable RLS on push_tokens
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own push tokens
CREATE POLICY "Users can view their own push tokens"
ON public.push_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens"
ON public.push_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens"
ON public.push_tokens FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_priority ON public.admin_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_group_key ON public.admin_notifications(group_key);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_status ON public.conversation_messages(status);