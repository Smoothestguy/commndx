import { expect, it } from 'bun:test';
import { onSiteNow, dedupeWeekEntries, weekKpis, billableEstimate, groupVendors, insuranceWarning } from './eventOverview';
const NOW = Date.parse('2026-11-25T14:00:00Z');
const Z = { A: 'America/New_York', B: 'America/New_York' };
const s = (id, p, loc, inAt, outAt = null, auto = null) => ({ visit_personnel_id: id, personnel_id: p, name: p, location_id: loc, in_at: inAt, out_at: outAt, auto_closed_at: auto });
it('open stay from an earlier day (>18h) is stale, not on site', () => {
  const r = onSiteNow([s('1', 'luis', 'A', '2026-11-24T12:00:00Z'), s('2', 'ana', 'A', '2026-11-25T12:00:00Z')], Z, NOW);
  expect(r.count).toBe(1); expect(r.people[0].personnel_id).toBe('ana'); expect(r.stale.map(x => x.personnel_id)).toEqual(['luis']);
});
it('auto-closed and checked-out stays never count on site; per-site breakdown and clocked-in today', () => {
  const r = onSiteNow([s('1', 'a', 'A', '2026-11-25T11:00:00Z'), s('2', 'b', 'B', '2026-11-25T11:00:00Z'), s('3', 'c', 'B', '2026-11-25T11:00:00Z', '2026-11-25T11:02:00Z'), s('4', 'd', 'B', '2026-11-25T11:00:00Z', null, '2026-11-25T13:00:00Z')], Z, NOW);
  expect(r.count).toBe(2); expect(r.bySite).toEqual({ A: 1, B: 1 }); expect(r.clockedInToday).toBe(4);
});
it('night shift opened 17h ago still counts as on site', () => {
  expect(onSiteNow([s('1', 'n', 'A', '2026-11-24T21:00:00Z')], Z, NOW).count).toBe(1);
});
it('person open at two sites counts once', () => {
  expect(onSiteNow([s('1', 'x', 'A', '2026-11-25T11:00:00Z'), s('2', 'x', 'B', '2026-11-25T12:00:00Z')], Z, NOW).count).toBe(1);
});
const e = (id, p, loc, inAt, outAt, hours, extra = {}) => ({ id, personnel_id: p, location_id: loc, entry_date: inAt.slice(0, 10), hours, in_at: inAt, out_at: outAt, ...extra });
it('overlapping stays at two sites count once and report excluded hours', () => {
  const r = dedupeWeekEntries([e('1', 'joe', 'A', '2026-11-23T12:00:00Z', '2026-11-24T00:00:00Z', 12), e('2', 'joe', 'B', '2026-11-23T18:00:00Z', '2026-11-24T06:00:00Z', 12)]);
  expect(r.overlapHours).toBe(6); expect(weekKpis(r.rows).hours).toBe(18); expect(r.overlapPeople).toEqual(['joe']);
});
it('stays under 5 minutes are excluded; hours-only rows kept', () => {
  const r = dedupeWeekEntries([e('1', 'a', 'A', '2026-11-23T12:00:00Z', '2026-11-23T12:03:00Z', 0.05), { id: '2', personnel_id: 'a', location_id: 'A', entry_date: '2026-11-24', hours: 8 }]);
  expect(r.shortExcluded.length).toBe(1); expect(weekKpis(r.rows)).toEqual({ personDays: 1, hours: 8 });
});
it('billable reports hours without a rate and skips non-billable people', () => {
  const r = dedupeWeekEntries([{ id: '1', personnel_id: 'a', location_id: 'A', entry_date: 'd', hours: 10 }, { id: '2', personnel_id: 'b', location_id: 'A', entry_date: 'd', hours: 5 }, { id: '3', personnel_id: 'c', location_id: 'A', entry_date: 'd', hours: 4 }]);
  const b = billableEstimate(r.rows, x => (x.personnel_id === 'a' ? 30 : null), p => p === 'c');
  expect(b).toEqual({ total: 300, missingHours: 5, missingRows: 1 });
});
it('vendors: 2+ people is an agency; duplicates match ignoring case/spaces; on-event first then hours', () => {
  const v = (id, name, total, now, h) => ({ id, name, peopleTotal: total, onEventNow: now, hoursWeek: h, billWeek: 0 });
  const g = groupVendors([v('1', 'DOM', 17, 2, 50), v('2', 'Samuel  GONZALEZ', 1, 0, 0), v('3', 'Samuel Gonzalez', 1, 1, 5), v('4', 'Zed', 1, 0, 40)]);
  expect(g.agencies.map(x => x.id)).toEqual(['1']); expect(g.individuals.map(x => x.id)).toEqual(['3', '4', '2']);
  expect(g.duplicateOf(g.individuals[0])).toEqual(['2']);
  expect(insuranceWarning('2026-12-10', '2026-11-25')).toBe('soon'); expect(insuranceWarning('2026-11-01', '2026-11-25')).toBe('expired');
});
