import { expect, it } from 'bun:test';
import { todaySites, noRecentClockIns, projectBadge } from './phoneToday';
const NOW = Date.parse('2026-11-24T18:00:00Z'); // 1300 New York
const L = [{ id: 'A', name: 'Site A', project_id: 'P', timezone: 'America/New_York' }, { id: 'B', name: 'Site B', project_id: 'P', timezone: 'America/New_York' }];
const base = { locations: L, projects: [{ id: 'P', name: 'EM-5052-Garner' }], now: NOW, resolutions: [], presence: [], requirements: [], expected: [] };
const st = (id, p, loc, inAt, outAt, sig = null) => ({ visit_personnel_id: id, personnel_id: p, location_id: loc, in_at: inAt, out_at: outAt, signature_url: sig, first_name: p });
it('stays under 5 minutes never count on sheet; sign-in sum is per location-local day', () => {
  const r = todaySites({ ...base, roster: [{ location_id: 'A', personnel_id: 'x' }, { location_id: 'A', personnel_id: 'y' }], trail: [st('1', 'x', 'A', '2026-11-24T12:30:00Z', '2026-11-24T16:00:00Z', 'sig'), st('2', 'y', 'A', '2026-11-24T12:30:00Z', '2026-11-24T12:33:00Z')] });
  expect(r.cards[0]).toMatchObject({ onSheet: 1, needAction: 0, missingSignatures: 0 });
  expect(r.onSheet).toBe(1);
});
it('roster with no stay and no resolution needs action; resolved does not', () => {
  const r = todaySites({ ...base, roster: [{ location_id: 'A', personnel_id: 'x' }, { location_id: 'A', personnel_id: 'z' }], resolutions: [{ location_id: 'A', personnel_id: 'z', day: '2026-11-24' }], trail: [] });
  expect(r.cards[0].needAction).toBe(1);
});
it('required uses carry-forward customer sheet; sites with most problems sort first', () => {
  const r = todaySites({ ...base, roster: [{ location_id: 'A', personnel_id: 'x' }, { location_id: 'B', personnel_id: 'q' }], expected: [{ location_id: 'B', day: '2026-11-20', supervisors: 1, technicians: 4, operators: 0 }],
    trail: [st('1', 'q', 'B', '2026-11-24T12:30:00Z', null)] });
  expect(r.cards.map(c => c.id)).toEqual(['B', 'A']);
  expect(r.cards[0]).toMatchObject({ required: 5, openPunches: 1, missingSignatures: 1 });
  expect(r.cards[1].required).toBeNull();
});
it('overlap at two sites and stale open punches go to Needs attention', () => {
  const r = todaySites({ ...base, roster: [], trail: [st('1', 'x', 'A', '2026-11-24T12:00:00Z', '2026-11-24T17:00:00Z'), st('2', 'x', 'B', '2026-11-24T13:00:00Z', '2026-11-24T16:00:00Z'), st('3', 'y', 'B', '2026-11-22T12:00:00Z', null)] });
  expect(r.cards.find(c => c.id === 'A').overlaps).toBe(1);
  expect(r.attention.filter(a => a.kind === 'overlap')).toHaveLength(1);
  expect(r.attention.some(a => a.kind === 'stale_open')).toBe(true);
});
it('no clock-in 2+ days flagged; yesterday is fine', () => {
  const trail = [st('1', 'x', 'A', '2026-11-21T12:00:00Z', '2026-11-21T20:00:00Z'), st('2', 'y', 'A', '2026-11-23T12:00:00Z', '2026-11-23T20:00:00Z')];
  const out = noRecentClockIns(L, [{ location_id: 'A', personnel_id: 'x' }, { location_id: 'A', personnel_id: 'y' }], trail, { x: 'Xavi' }, NOW);
  expect(out.map(a => a.key)).toEqual(['idle:x']);
  expect(projectBadge('November FL Flood', 'EM - 5053 - FL - Tiger Dam')).toBe('5053');
  expect(projectBadge('Hurricane Isaias', 'Base')).toBe('Hurricane Isa…');
});
