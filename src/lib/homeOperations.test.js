import { expect, it } from 'bun:test';
import { homeView, upcomingDemobe, signatureCounts, homeLocationState, closedDayHours } from './homeOperations';

it('only admin and manager get operational Home; field users never get Sales', () => {
  expect(homeView('admin')).toBe('operations');
  expect(homeView('manager')).toBe('operations');
  expect(homeView('user')).toBe('my-day');
  expect(homeView(null)).toBe('my-day');
});
it('includes demobilizations through the next three local days, excluding past and fourth day', () => {
  expect(upcomingDemobe('2026-11-09', '2026-11-06')).toBe(true);
  expect(upcomingDemobe('2026-11-10', '2026-11-06')).toBe(false);
  expect(upcomingDemobe('2026-11-05', '2026-11-06')).toBe(false);
});
it('counts multiple stays once and any signed stay covers the same person that day', () => {
  expect(signatureCounts([{ personnel_id: 'a', signature_url: null }, { personnel_id: 'a', signature_url: 'private/ink.png' }, { personnel_id: 'b', signature_url: null }])).toEqual({ total: 2, missing: 1 });
});
it('preserves per-role overage even when total staffing matches authorization', () => {
  const state = homeLocationState({ Operator: { needed: 16, assigned: 17 }, Supervisor: { needed: 4, assigned: 3 } }, null,
    { late: 0, joinPending: 0, openPunches: 0, pendingTOs: 0, extPending: 0 }, { assetUnder: 6, assetOver: 0 }, 0, 0);
  expect(state.severity).toBe('red');
  expect(state.worst.label).toBe('Operator +1 OVER');
});
it('counts Chicago midnight ledger segments only within the site local day', () => {
  const common={clock_in_at:'2026-11-06T23:00:00Z',clock_out_at:'2026-11-07T09:00:00Z'};
  const first={...common,entry_date:'2026-11-06',hours:7},second={...common,entry_date:'2026-11-07',hours:3};
  expect(closedDayHours(first,'2026-11-06','America/New_York')+closedDayHours(second,'2026-11-06','America/New_York')).toBe(6);
  expect(closedDayHours(first,'2026-11-07','America/New_York')+closedDayHours(second,'2026-11-07','America/New_York')).toBe(4);
});