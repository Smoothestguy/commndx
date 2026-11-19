import { test, expect } from 'bun:test';
import { remainingOnboardingDays, resolveShareToken } from './onboardingShare.ts';
import { createOnlyMode } from '../../supabase/functions/_shared/onboardingSendMode.ts';
test('remaining days use token expiry rather than fixed seven days', () => {
 expect(remainingOnboardingDays('2026-11-26T16:00:00Z', Date.parse('2026-11-19T16:00:00Z'))).toBe(7);
 expect(remainingOnboardingDays('2026-11-21T17:00:00Z', Date.parse('2026-11-19T16:00:00Z'))).toBe(3);
});
test('valid current token does not mint', async () => { let created=0; const token={token:'existing',expires_at:'2026-12-01',used_at:null,revoked_at:null}; expect(await resolveShareToken(async()=>token,async()=>{created++;return token;})).toBe(token);expect(created).toBe(0); });
test('absent current token mints once', async () => {let created=0;await resolveShareToken(async()=>null,async()=>{created++;return {token:'new',expires_at:'2026-12-01',used_at:null,revoked_at:null};});expect(created).toBe(1);});
test('createOnly true skips delivery and default retains email',()=>{expect(createOnlyMode(true)).toBe(true);expect(createOnlyMode(undefined)).toBe(false);expect(createOnlyMode(false)).toBe(false);expect(()=>createOnlyMode('true')).toThrow();});
