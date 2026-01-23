-- Add DELETE policy for conversation_messages (inbox messages)
CREATE POLICY "Users can delete their own conversation messages" 
ON conversation_messages 
FOR DELETE 
USING (sender_type = 'user' AND sender_id = auth.uid());

-- Add DELETE policy for messages (SMS blasts)
CREATE POLICY "Users can delete messages they sent" 
ON messages 
FOR DELETE 
USING (sent_by = auth.uid());