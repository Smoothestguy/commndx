-- Table to store AI dev assistant conversations (admin only)
CREATE TABLE public.ai_dev_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table to store messages within conversations
CREATE TABLE public.ai_dev_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.ai_dev_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  response_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_dev_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_dev_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_dev_conversations (admin only, own records)
CREATE POLICY "Admins can view their own dev conversations"
  ON public.ai_dev_conversations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());

CREATE POLICY "Admins can insert their own dev conversations"
  ON public.ai_dev_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());

CREATE POLICY "Admins can update their own dev conversations"
  ON public.ai_dev_conversations
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());

CREATE POLICY "Admins can delete their own dev conversations"
  ON public.ai_dev_conversations
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());

-- RLS Policies for ai_dev_messages (admin only, must own parent conversation)
CREATE POLICY "Admins can view messages in their conversations"
  ON public.ai_dev_messages
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ai_dev_conversations c
    WHERE c.id = ai_dev_messages.conversation_id
    AND c.user_id = auth.uid()
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ));

CREATE POLICY "Admins can insert messages in their conversations"
  ON public.ai_dev_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_dev_conversations c
    WHERE c.id = ai_dev_messages.conversation_id
    AND c.user_id = auth.uid()
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ));

CREATE POLICY "Admins can update messages in their conversations"
  ON public.ai_dev_messages
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ai_dev_conversations c
    WHERE c.id = ai_dev_messages.conversation_id
    AND c.user_id = auth.uid()
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ));

CREATE POLICY "Admins can delete messages in their conversations"
  ON public.ai_dev_messages
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ai_dev_conversations c
    WHERE c.id = ai_dev_messages.conversation_id
    AND c.user_id = auth.uid()
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ));

-- Trigger for updated_at on conversations
CREATE TRIGGER update_ai_dev_conversations_updated_at
  BEFORE UPDATE ON public.ai_dev_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();