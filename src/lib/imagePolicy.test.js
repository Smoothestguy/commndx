import { describe, expect, test } from 'bun:test';
import { imageEligible, imageDimensions } from '../../supabase/functions/_shared/imagePolicy.ts';
describe('stored image compression policy', () => {
  test('caps longest side at 1600 pixels', () => expect(imageDimensions(4000, 3000)).toEqual([1600, 1200]));
  test('allows profile photos, kiosk selfies and reimbursement receipts', () => {
    expect(imageEligible('personnel-photos', 'p/a.jpg', 'image/jpeg')).toBe(true);
    expect(imageEligible('project-documents', 'field-captures/kiosk/l/s/selfie.jpg', 'image/jpeg')).toBe(true);
    expect(imageEligible('document-attachments', 'reimbursement-receipts/u/r.png', 'image/png')).toBe(true);
  });
  test('never touches signatures or locked sheets', () => {
    expect(imageEligible('project-documents', 'field-captures/kiosk/l/s/signature.png', 'image/png')).toBe(false);
    expect(imageEligible('project-documents', 'locked/sheet.png', 'image/png')).toBe(false);
  });
});
