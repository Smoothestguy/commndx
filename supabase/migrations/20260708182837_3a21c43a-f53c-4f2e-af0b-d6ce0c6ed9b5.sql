ALTER TABLE public.conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_sender_type_check;

ALTER TABLE public.conversation_messages
ADD CONSTRAINT conversation_messages_sender_type_check
CHECK (sender_type = ANY (ARRAY['user'::text, 'personnel'::text, 'customer'::text, 'applicant'::text]));