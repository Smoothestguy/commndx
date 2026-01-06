-- Update the messages_message_type_check constraint to include assignment_notification
ALTER TABLE public.messages DROP CONSTRAINT messages_message_type_check;

ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check 
  CHECK (message_type = ANY (ARRAY['sms'::text, 'email'::text, 'assignment_notification'::text]));