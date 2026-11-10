export function imageEligible(bucket: string, path: string, mime: string) {
  if (!['image/jpeg', 'image/png'].includes(mime)) return false;
  if (/(signature|signed|countersign|locked|\.pdf|optimized\/)/i.test(path)) return false;
  return bucket === 'personnel-photos' ||
    (['application-files', 'form-uploads'].includes(bucket) && path.startsWith('profile-photos/')) ||
    (bucket === 'document-attachments' && path.startsWith('reimbursement-receipts/')) ||
    (bucket === 'project-documents' && /^field-captures\/kiosk\/[^/]+\/[^/]+\/selfie\.jpg$/.test(path));
}
export function imageDimensions(width: number, height: number, cap = 1600) {
  const scale = Math.min(1, cap / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}
export const COMPRESSION_AGE_DAYS = 30;
export const JPEG_QUALITY = 70;
export const THUMBNAIL_SIZE = 128;