ALTER TABLE public.image_optimizations ADD COLUMN IF NOT EXISTS optimized_path text;
CREATE OR REPLACE FUNCTION public.image_compression_candidates(p_limit integer) RETURNS TABLE(bucket_id text, object_path text, mime text, bytes bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public, storage AS $$
SELECT o.bucket_id, o.name, o.metadata->>'mimetype', coalesce((o.metadata->>'size')::bigint,0)
FROM storage.objects o
WHERE o.created_at < now()-interval '30 days'
AND o.metadata->>'mimetype' IN ('image/jpeg','image/png')
AND o.name !~* '(signature|signed|countersign|locked|\.thumb\.jpg$|\.optimized\.jpg$)'
AND ((o.bucket_id='personnel-photos') OR (o.bucket_id IN ('application-files','form-uploads') AND o.name LIKE 'profile-photos/%') OR (o.bucket_id='project-documents' AND o.name ~ '^field-captures/kiosk/[^/]+/[^/]+/selfie\.jpg$') OR (o.bucket_id='document-attachments' AND o.name LIKE 'reimbursement-receipts/%'))
AND NOT EXISTS (SELECT 1 FROM public.image_optimizations i WHERE i.bucket_id=o.bucket_id AND i.object_path=o.name)
ORDER BY coalesce((o.metadata->>'size')::bigint,0) DESC
LIMIT least(greatest(p_limit,1),25) $$;
REVOKE ALL ON FUNCTION public.image_compression_candidates(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.image_compression_candidates(integer) TO service_role;