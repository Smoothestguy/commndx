-- Allow users to mark messages as read in conversations they participate in
CREATE POLICY "Users can mark messages as read in their conversations"
  ON conversation_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (
        (c.participant_1_type = 'user' AND c.participant_1_id = auth.uid())
        OR (c.participant_2_type = 'user' AND c.participant_2_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (
        (c.participant_1_type = 'user' AND c.participant_1_id = auth.uid())
        OR (c.participant_2_type = 'user' AND c.participant_2_id = auth.uid())
      )
    )
  );