export const EVIDENCE_BUCKETS = ['field-captures', 'application-files', 'form-uploads'] as const;
export const PRIVATE_MEDIA_TTL = 600;
export const PUBLIC_MEDIA_BUCKETS = ['logos', 'dashboard-backgrounds'] as const;
export function isPublicMediaBucket(bucket: string) {
  return PUBLIC_MEDIA_BUCKETS.some(value => value === bucket);
}