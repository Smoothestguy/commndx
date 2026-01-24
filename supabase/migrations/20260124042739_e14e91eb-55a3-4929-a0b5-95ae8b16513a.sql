-- Migration: Migrate legacy SMS messages to conversations system

-- Step 1: Create conversations for unique sender-recipient pairs from legacy messages
INSERT INTO conversations (
  participant_1_type, participant_1_id,
  participant_2_type, participant_2_id,
  last_message_at, last_message_preview, created_at
)
SELECT 
  'user' as participant_1_type,
  m.sent_by as participant_1_id,
  m.recipient_type as participant_2_type,
  m.recipient_id as participant_2_id,
  MAX(m.created_at) as last_message_at,
  (SELECT content FROM messages m2 
   WHERE m2.sent_by = m.sent_by 
     AND m2.recipient_id = m.recipient_id 
     AND m2.recipient_type = m.recipient_type
   ORDER BY m2.created_at DESC LIMIT 1) as last_message_preview,
  MIN(m.created_at) as created_at
FROM messages m
WHERE m.sent_by IS NOT NULL
  AND m.recipient_id IS NOT NULL
  AND NOT EXISTS (
    -- Skip if conversation already exists
    SELECT 1 FROM conversations c
    WHERE (c.participant_1_id = m.sent_by AND c.participant_2_id = m.recipient_id)
       OR (c.participant_2_id = m.sent_by AND c.participant_1_id = m.recipient_id)
  )
GROUP BY m.sent_by, m.recipient_type, m.recipient_id;

-- Step 2: Create conversation participants for sender (user)
INSERT INTO conversation_participants (conversation_id, participant_type, participant_id, created_at)
SELECT c.id, c.participant_1_type, c.participant_1_id, c.created_at
FROM conversations c
WHERE NOT EXISTS (
  SELECT 1 FROM conversation_participants cp 
  WHERE cp.conversation_id = c.id 
    AND cp.participant_id = c.participant_1_id
);

-- Step 3: Create conversation participants for recipient
INSERT INTO conversation_participants (conversation_id, participant_type, participant_id, created_at)
SELECT c.id, c.participant_2_type, c.participant_2_id, c.created_at
FROM conversations c
WHERE NOT EXISTS (
  SELECT 1 FROM conversation_participants cp 
  WHERE cp.conversation_id = c.id 
    AND cp.participant_id = c.participant_2_id
);

-- Step 4: Insert legacy messages into conversation_messages
INSERT INTO conversation_messages (
  conversation_id, sender_type, sender_id, content, message_type, 
  status, delivered_at, created_at
)
SELECT 
  c.id as conversation_id,
  CASE 
    WHEN m.direction = 'inbound' THEN m.recipient_type 
    ELSE 'user' 
  END as sender_type,
  CASE 
    WHEN m.direction = 'inbound' THEN m.recipient_id 
    ELSE m.sent_by 
  END as sender_id,
  m.content,
  'sms' as message_type,
  m.status,
  m.sent_at as delivered_at,
  m.created_at
FROM messages m
JOIN conversations c ON (
  (c.participant_1_id = m.sent_by AND c.participant_2_id = m.recipient_id)
  OR (c.participant_2_id = m.sent_by AND c.participant_1_id = m.recipient_id)
)
WHERE m.sent_by IS NOT NULL
  AND m.recipient_id IS NOT NULL
  AND NOT EXISTS (
    -- Skip if message already migrated (based on content + timestamp match)
    SELECT 1 FROM conversation_messages cm 
    WHERE cm.conversation_id = c.id 
      AND cm.content = m.content 
      AND cm.created_at = m.created_at
  );