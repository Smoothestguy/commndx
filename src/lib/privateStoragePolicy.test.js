import { it, expect } from 'bun:test';
import { EVIDENCE_BUCKETS, PRIVATE_MEDIA_TTL, isPublicMediaBucket } from './privateStoragePolicy';
it('field captures never use public reads', () => expect(isPublicMediaBucket('field-captures')).toBe(false));
it('application uploads never use public reads', () => expect(isPublicMediaBucket('application-files')).toBe(false));
it('form uploads never use public reads', () => expect(isPublicMediaBucket('form-uploads')).toBe(false));
it('private media signatures expire after ten minutes', () => expect(PRIVATE_MEDIA_TTL).toBe(600));
it('only non-evidence branding stays public', () => {
  expect(isPublicMediaBucket('logos')).toBe(true);
  expect(isPublicMediaBucket('dashboard-backgrounds')).toBe(true);
  expect(EVIDENCE_BUCKETS).toEqual(['field-captures','application-files','form-uploads']);
});