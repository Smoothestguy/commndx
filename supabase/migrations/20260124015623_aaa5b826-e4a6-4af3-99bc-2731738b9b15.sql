-- Create typing_indicators table for real-time typing status
CREATE TABLE typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('user', 'personnel', 'customer')),
  user_name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id, user_type)
);

-- Enable RLS
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

-- Allow participants to see typing status in their conversations
CREATE POLICY "Users can view typing in their conversations"
  ON typing_indicators FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND (
    (c.participant_1_type = 'user' AND c.participant_1_id = auth.uid())
    OR (c.participant_2_type = 'user' AND c.participant_2_id = auth.uid())
  )));

-- Allow users to insert their typing status
CREATE POLICY "Users can set their typing status"
  ON typing_indicators FOR INSERT TO authenticated
  WITH CHECK (user_type = 'user' AND user_id = auth.uid());

-- Allow users to update their typing status
CREATE POLICY "Users can update their typing status"
  ON typing_indicators FOR UPDATE TO authenticated
  USING (user_type = 'user' AND user_id = auth.uid());

-- Allow users to remove their typing status
CREATE POLICY "Users can remove their typing status"
  ON typing_indicators FOR DELETE TO authenticated
  USING (user_type = 'user' AND user_id = auth.uid());

-- Enable realtime for typing indicators
ALTER PUBLICATION supabase_realtime ADD TABLE typing_indicators;

-- Auto-cleanup function to remove stale typing indicators (older than 5 seconds)
CREATE OR REPLACE FUNCTION cleanup_stale_typing()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM typing_indicators WHERE started_at < now() - interval '5 seconds';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to cleanup stale typing indicators on each insert
CREATE TRIGGER cleanup_typing_trigger
  AFTER INSERT ON typing_indicators
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_stale_typing();