-- Create RPC function to increment unread count for conversation participants
CREATE OR REPLACE FUNCTION public.increment_unread_count(
  p_conversation_id UUID,
  p_exclude_type TEXT,
  p_exclude_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.conversation_participants
  SET unread_count = COALESCE(unread_count, 0) + 1
  WHERE conversation_id = p_conversation_id
    AND NOT (participant_type = p_exclude_type AND participant_id = p_exclude_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;