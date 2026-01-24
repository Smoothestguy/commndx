-- Update CHECK constraint to allow 'applicant' as participant type
ALTER TABLE conversation_participants 
DROP CONSTRAINT IF EXISTS conversation_participants_participant_type_check;

ALTER TABLE conversation_participants 
ADD CONSTRAINT conversation_participants_participant_type_check 
CHECK (participant_type IN ('user', 'personnel', 'customer', 'applicant'));

-- Also update conversations table constraints for participant types
ALTER TABLE conversations 
DROP CONSTRAINT IF EXISTS conversations_participant_1_type_check;

ALTER TABLE conversations 
DROP CONSTRAINT IF EXISTS conversations_participant_2_type_check;

ALTER TABLE conversations 
ADD CONSTRAINT conversations_participant_1_type_check 
CHECK (participant_1_type IN ('user', 'personnel', 'customer', 'applicant'));

ALTER TABLE conversations 
ADD CONSTRAINT conversations_participant_2_type_check 
CHECK (participant_2_type IN ('user', 'personnel', 'customer', 'applicant'));