import { expect, test } from 'bun:test';
import { unsignedDates, resendWaitMs, requestMessage } from '../../supabase/functions/_shared/signatureBundle';

const z = 'America/New_York';
test('lists each unsigned worked date once, skipping signed dates', () => {
  const stays = [
    { in_at: '2026-11-04T11:30:00Z', visit_personnel_id: 'a', signature_url: null },
    { in_at: '2026-11-05T11:30:00Z', visit_personnel_id: 'b', signature_url: 'x.png' },
    { in_at: '2026-11-07T11:30:00Z', visit_personnel_id: 'c', signature_url: null },
    { in_at: '2026-11-07T20:00:00Z', visit_personnel_id: 'd', signature_url: null },
  ];
  expect(unsignedDates(stays, z)).toEqual(['2026-11-04', '2026-11-07']);
});
test('dates use the location timezone, not UTC', () => {
  expect(unsignedDates([{ in_at: '2026-11-05T03:00:00Z', visit_personnel_id: 'a', signature_url: null }], z)).toEqual(['2026-11-04']);
});
test('resend is blocked for one minute after the latest send', () => {
  const now = Date.parse('2026-11-09T14:00:00Z');
  expect(resendWaitMs('2026-11-09T13:59:30Z', now)).toBe(30000);
  expect(resendWaitMs('2026-11-09T13:59:00Z', now)).toBe(0);
  expect(resendWaitMs(null, now)).toBe(0);
});
test('multi-day text lists all dates in one message', () => {
  expect(requestMessage('5049-FCOCO', ['2026-11-04', '2026-11-05', '2026-11-07'], 'L')).toBe('Please sign your timesheets for 11/04, 11/05, 11/07 at 5049-FCOCO (3 days): L');
});
test('branded location texts lead with the location company name and never the default one', () => {
  const m = requestMessage('5052-FL-WPB-Garner', ['2026-11-18', '2026-11-19'], 'https://commndx.com/timesheet-sign/t', 'Patriot Response Group LLC');
  expect(m.startsWith('Patriot Response Group LLC: ')).toBe(true);
  expect(m).not.toMatch(/fairfield/i);
});
test('unbranded texts are unchanged', () => {
  expect(requestMessage('X', ['2026-11-18'], 'L')).toBe('Please sign your timesheet for X on 11/18/2026: L');
});
