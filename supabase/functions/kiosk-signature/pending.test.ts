import { expect, test } from 'bun:test';
import { pendingItems } from '../_shared/kioskPending';
const stay = { visit_personnel_id: 'worked', in_at: '2026-11-06T12:30:00Z', out_at: null, signature_url: null, late_minutes: 10, late_reason: null };
test('unsigned earlier day includes signature, forgotten checkout and required late reason', () => {
  expect(pendingItems([stay], [], 'America/New_York', '2026-11-07T12:00:00Z').map(i => i.type)).toEqual(['signature', 'checkout', 'late']);
});
test('pending day request is fulfilled even when a day already has ink', () => {
  const items = pendingItems([{ ...stay, signature_url: 'private.png', out_at: '2026-11-07T00:30:00Z', late_reason: 'Traffic' }], [{ sheet_date: '2026-11-06', status: 'pending' }], 'America/New_York', '2026-11-07T12:00:00Z');
  expect(items).toHaveLength(1); expect(items[0].requested).toBe(true);
});
test('empty completed days dismiss and current local day is not a forgotten checkout', () => {
  expect(pendingItems([{ ...stay, signature_url: 'private.png', late_reason: 'Traffic' }], [], 'America/New_York', '2026-11-07T02:00:00Z')).toEqual([]);
});