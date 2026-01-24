-- Add AI verification tracking columns to personnel_documents table
ALTER TABLE public.personnel_documents
ADD COLUMN IF NOT EXISTS ai_verified BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_verification_confidence TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_verification_result JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for quick filtering of unverified documents
CREATE INDEX IF NOT EXISTS idx_personnel_documents_ai_verified 
ON public.personnel_documents(ai_verified) 
WHERE ai_verified IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.personnel_documents.ai_verified IS 'Result of AI document verification (true=passed, false=failed, null=not verified)';
COMMENT ON COLUMN public.personnel_documents.ai_verification_confidence IS 'AI confidence level: high, medium, or low';
COMMENT ON COLUMN public.personnel_documents.ai_verification_result IS 'Full JSON result from AI verification including extracted data';
COMMENT ON COLUMN public.personnel_documents.ai_verified_at IS 'Timestamp when AI verification was performed';