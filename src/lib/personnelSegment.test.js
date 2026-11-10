import { it, expect } from 'bun:test';
import { personnelSegment, matchesAllTags, pickerCompare, mergeEngagements } from './personnelSegment';

it('customer employer (Patriot) is customer personnel even if a vendor is set', () => {
  expect(personnelSegment({ employer_customer_id: 'patriot', vendor_id: 'v' })).toBe('customer');
  expect(personnelSegment({ vendor_id: 'v' })).toBe('agency');
  expect(personnelSegment({})).toBe('frg');
});
it('tag filter English + CDL requires both, case-insensitive', () => {
  expect(matchesAllTags(['english', 'CDL', 'Forklift'], ['English', 'CDL'])).toBe(true);
  expect(matchesAllTags(['English'], ['English', 'CDL'])).toBe(false);
});
it('pickers list FRG first, then agency, then customer; bench first in group', () => {
  const ppl = [
    { first_name: 'C', employer_customer_id: 'x' }, { first_name: 'A', vendor_id: 'v' },
    { first_name: 'Z' }, { first_name: 'B', on_bench: true },
  ];
  expect([...ppl].sort(pickerCompare).map(p => p.first_name)).toEqual(['B', 'Z', 'A', 'C']);
});
it('engagements merge per location with earliest start and ongoing end', () => {
  const e = mergeEngagements([
    { project_id: 'p', location_id: 'l', role: 'Op', start: '2026-11-01', end: '2026-11-03' },
    { project_id: 'p', location_id: 'l', role: 'Sup', start: '2026-11-05', end: null },
    { project_id: 'p', location_id: null, role: null, start: '2026-10-30', end: null },
  ]);
  expect(e).toHaveLength(1);
  expect(e[0]).toMatchObject({ start: '2026-11-01', end: null, roles: ['Op', 'Sup'] });
});
