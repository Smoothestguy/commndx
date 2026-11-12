import { it, expect } from 'bun:test';
import { canReviewJoinRequests, pendingJoinRequests, joinExpiry, joinFormSchema, joinInfoSchema, joinResultSchema, joinToken, publicJoinUrl } from './projectJoin';
it('token info retains DOM agency branding but strips vendor financial fields', () => {
  expect(joinInfoSchema.parse({ valid: true, agency_name: 'DOM SOLUTIONS', agency_logo_url: null, pay_rate: 100, vendor_id: 'private' })).toEqual({ valid: true, agency_name: 'DOM SOLUTIONS', agency_logo_url: null });
});
it('token info accepts FRG tokens without an agency', () => {
  expect(joinInfoSchema.parse({ valid: true, project_name: 'Florida Floods', agency_name: null }).agency_name).toBeNull();
});
it('token info rejects unsafe agency logo protocols without losing the agency name', () => {
  const info = joinInfoSchema.parse({ valid: true, agency_name: 'DOM SOLUTIONS', agency_logo_url: 'javascript:alert(1)' });
  expect(info.agency_name).toBe('DOM SOLUTIONS'); expect(info.agency_logo_url).toBeNull();
});
it('join links default to a 30-day lifetime', () => { expect(joinExpiry(30, new Date('2026-11-06T00:00:00Z'))).toBe('2026-12-06T00:00:00.000Z'); });
it('join expiry must be a positive whole day count', () => { expect(() => joinExpiry(0)).toThrow(); expect(() => joinExpiry(1.5)).toThrow(); });
const form = { first: 'Patrick', last: 'Ricci', phone: '2815550100', email: '' };
it('first and last names are required', () => { expect(joinFormSchema.safeParse({ ...form, first: '' }).success).toBe(false); expect(joinFormSchema.safeParse({ ...form, last: '' }).success).toBe(false); });
it('mobile phone is required and allows US country prefix', () => { expect(joinFormSchema.safeParse({ ...form, phone: '' }).success).toBe(false); expect(joinFormSchema.safeParse({ ...form, phone: '+1 (281) 555-0100' }).success).toBe(true); });
it('email is optional but validates when supplied', () => { expect(joinFormSchema.safeParse(form).success).toBe(true); expect(joinFormSchema.safeParse({ ...form, email: 'invalid' }).success).toBe(false); });
it('public response discards personal punch links even if unexpectedly returned', () => { expect(joinResultSchema.parse({ ok: true, status: 'pending', punch_token: '550e8400-e29b-41d4-a716-446655440000', personnel_id: 'private' })).toEqual({ ok: true, status: 'pending' }); });
it('field supervisors can review alongside admin and manager only', () => { expect(canReviewJoinRequests('user')).toBe(true); expect(canReviewJoinRequests('admin')).toBe(true); expect(canReviewJoinRequests('manager')).toBe(true); expect(canReviewJoinRequests('personnel')).toBe(false); expect(canReviewJoinRequests('vendor')).toBe(false); expect(canReviewJoinRequests(null)).toBe(false); });
it('pending badges scope to location without including approved or denied requests', () => { const rows = [{ status: 'pending', location_id: 'a' }, { status: 'pending', location_id: 'b' }, { status: 'pending', location_id: null }, { status: 'approved', location_id: 'a' }, { status: 'denied', location_id: 'a' }]; expect(pendingJoinRequests(rows, 'a')).toEqual([{ status: 'pending', location_id: 'a' }]); expect(pendingJoinRequests(rows).length).toBe(3); });
it('join token must be a UUID before public info request', () => { expect(joinToken.safeParse('not-a-token').success).toBe(false); });
it('shared links use published domain rather than preview', () => { expect(publicJoinUrl('test', 'http://localhost:8080')).toBe('https://fairfieldrg.com/join/test'); });