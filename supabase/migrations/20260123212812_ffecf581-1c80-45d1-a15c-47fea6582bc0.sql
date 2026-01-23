-- Add response tracking columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS has_response BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS response_content TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS response_received_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound'));
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES messages(id);

-- Create index for parent message lookups
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_phone ON messages(recipient_phone);

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_type TEXT NOT NULL CHECK (participant_1_type IN ('user', 'personnel', 'customer')),
  participant_1_id UUID NOT NULL,
  participant_2_type TEXT NOT NULL CHECK (participant_2_type IN ('user', 'personnel', 'customer')),
  participant_2_id UUID NOT NULL,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(participant_1_type, participant_1_id, participant_2_type, participant_2_id)
);

-- Create conversation_messages table
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'personnel', 'customer')),
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'in_app' CHECK (message_type IN ('in_app', 'sms')),
  read_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create conversation_participants for tracking unread counts
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('user', 'personnel', 'customer')),
  participant_id UUID NOT NULL,
  unread_count INTEGER DEFAULT 0,
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, participant_type, participant_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conv_messages_conv_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_created ON conversation_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_participants_lookup ON conversation_participants(participant_type, participant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- Enable realtime for conversation tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;

-- RLS for conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    (participant_1_type = 'user' AND participant_1_id = auth.uid())
    OR (participant_2_type = 'user' AND participant_2_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_1_type = 'user' AND participant_1_id = auth.uid()
  );

CREATE POLICY "Users can update their conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    (participant_1_type = 'user' AND participant_1_id = auth.uid())
    OR (participant_2_type = 'user' AND participant_2_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- RLS for conversation_messages
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations"
  ON conversation_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (
        (c.participant_1_type = 'user' AND c.participant_1_id = auth.uid())
        OR (c.participant_2_type = 'user' AND c.participant_2_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
      )
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON conversation_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'user' AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (
        (c.participant_1_type = 'user' AND c.participant_1_id = auth.uid())
        OR (c.participant_2_type = 'user' AND c.participant_2_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
      )
    )
  );

-- RLS for conversation_participants
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view participant records"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (
        (c.participant_1_type = 'user' AND c.participant_1_id = auth.uid())
        OR (c.participant_2_type = 'user' AND c.participant_2_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
      )
    )
  );

CREATE POLICY "Users can update their participant records"
  ON conversation_participants FOR UPDATE
  TO authenticated
  USING (
    participant_type = 'user' AND participant_id = auth.uid()
  );

CREATE POLICY "Users can insert participant records"
  ON conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (
        (c.participant_1_type = 'user' AND c.participant_1_id = auth.uid())
        OR (c.participant_2_type = 'user' AND c.participant_2_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
      )
    )
  );

-- Trigger to update conversation last_message_at when new message is added
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = now()
  WHERE id = NEW.conversation_id;
  
  -- Increment unread count for other participant
  UPDATE conversation_participants
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
    AND NOT (participant_type = NEW.sender_type AND participant_id = NEW.sender_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();