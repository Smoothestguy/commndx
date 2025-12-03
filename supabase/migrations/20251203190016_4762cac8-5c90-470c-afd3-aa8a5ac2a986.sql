-- Create messages table for SMS/messaging history
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('customer', 'personnel')),
  recipient_id UUID NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'sms' CHECK (message_type IN ('sms', 'email')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  external_id TEXT,
  error_message TEXT,
  sent_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and managers can manage messages"
  ON public.messages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view messages"
  ON public.messages FOR SELECT
  USING (true);

-- Indexes for faster lookups
CREATE INDEX idx_messages_recipient ON public.messages(recipient_type, recipient_id);
CREATE INDEX idx_messages_status ON public.messages(status);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();