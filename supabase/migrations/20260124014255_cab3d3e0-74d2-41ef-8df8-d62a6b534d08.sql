-- Add DELETE policy for conversations table
-- Allow users to delete conversations they are a participant of
CREATE POLICY "Users can delete their conversations"
  ON conversations 
  FOR DELETE
  TO authenticated
  USING (
    (participant_1_type = 'user' AND participant_1_id = auth.uid())
    OR (participant_2_type = 'user' AND participant_2_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Add DELETE policy for conversation_participants table
-- Allow users to delete participant records for conversations they own
CREATE POLICY "Users can delete participant records for their conversations"
  ON conversation_participants
  FOR DELETE
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