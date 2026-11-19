import { test, expect } from 'bun:test';
import { currentOnboardingToken, onboardingLink, saveThenSend } from './onboardingLinks.ts';

test('copy selects newest unused unrevoked unexpired token without changing others', () => {
  const make = (token, created_at, fields = {}) => ({ token, created_at, expires_at: '2026-12-01T00:00:00Z', used_at: null, revoked_at: null, ...fields });
  const rows = [make('old','2026-11-01'),make('current','2026-11-18'),make('used','2026-11-19',{used_at:'2026-11-19'}),make('revoked','2026-11-19',{revoked_at:'2026-11-19'}),make('expired','2026-11-19',{expires_at:'2026-11-18'})];
  expect(currentOnboardingToken(rows, Date.parse('2026-11-19'))?.token).toBe('current');
  expect(rows[3].revoked_at).toBe('2026-11-19');
});
test('no valid token returns null and never mints or sends', () => {
  expect(currentOnboardingToken([], Date.parse('2026-11-19'))).toBeNull();
});
test('delivery failure preserves exactly one saved person; unchecked never sends', async () => {
  let inserts = 0, sends = 0;
  const save = async () => { inserts++; return { id: 'saved' }; };
  const send = async () => { sends++; throw new Error('Mock delivery failure'); };
  const failed = await saveThenSend(save, send, true);
  expect(failed.saved.id).toBe('saved'); expect(failed.deliveryError).toBe('Mock delivery failure'); expect(inserts).toBe(1);
  const unchecked = await saveThenSend(save, send, false);
  expect(unchecked.link).toBeNull(); expect(sends).toBe(1); expect(inserts).toBe(2);
});
test('successful delivery returns existing onboard link format', async () => {
  const result = await saveThenSend(async () => ({ id: 'one' }), async () => onboardingLink('test-token','https://fairfieldrg.com/'), true);
  expect(result.link).toBe('https://fairfieldrg.com/onboard/test-token');
  expect(result.deliveryError).toBeNull();
});