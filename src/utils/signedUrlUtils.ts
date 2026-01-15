import { supabase } from "@/integrations/supabase/client";

// Buckets that require signed URLs
const PRIVATE_BUCKETS = ['personnel-photos', 'application-files', 'document-attachments'];

/**
 * Extract file path from a full public URL or return path as-is
 */
export function getPathFromUrl(urlOrPath: string, bucket: string): string {
  if (!urlOrPath) return '';
  
  // If it's already just a path (no http), return as-is
  if (!urlOrPath.startsWith('http')) return urlOrPath;
  
  // Extract path from full Supabase URL
  const bucketPattern = `/storage/v1/object/public/${bucket}/`;
  const index = urlOrPath.indexOf(bucketPattern);
  if (index !== -1) {
    return urlOrPath.substring(index + bucketPattern.length);
  }
  
  return urlOrPath;
}

/**
 * Generate signed URL for private bucket access
 * Handles both full URLs (legacy) and paths (new format)
 */
export async function getSignedUrl(
  bucket: string,
  urlOrPath: string | null,
  expiresIn = 3600
): Promise<string | null> {
  if (!urlOrPath) return null;
  
  const path = getPathFromUrl(urlOrPath, bucket);
  if (!path) return null;
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  
  if (error) {
    console.error("Error creating signed URL:", error);
    return null;
  }
  return data?.signedUrl || null;
}

/**
 * Check if a bucket requires signed URLs
 */
export function requiresSignedUrl(bucket: string): boolean {
  return PRIVATE_BUCKETS.includes(bucket);
}

/**
 * Determine which bucket a URL belongs to based on its content
 */
export function getBucketFromUrl(url: string): string | null {
  if (!url) return null;
  
  for (const bucket of PRIVATE_BUCKETS) {
    if (url.includes(`/${bucket}/`)) {
      return bucket;
    }
  }
  return null;
}
