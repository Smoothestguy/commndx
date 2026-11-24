import { describe, it, expect } from 'vitest';
import { staffingBreakdown, fmtDiff } from './staffingBreakdown';
describe('staffingBreakdown', () => {
  it('present minus required, case-insensitive, distinct people, unmatched separate', () => {
    const { rows, total } = staffingBreakdown([{ role_label: 'Tech', headcount_needed: 10 }, { role_label: 'Equip Operator', headcount_needed: 1 }],
      [{ id: 'a', role: 'tech ', present: true }, { id: 'a', role: 'Tech', present: true }, { id: 'b', role: 'Tech', present: true }, { id: 'c', role: 'Operator', present: true }, { id: 'd', role: null, present: true }, { id: 'e', role: 'Tech', present: false }]);
    expect(rows.find(r => r.role === 'Tech')).toMatchObject({ required: 10, present: 2, diff: -8 });
    expect(rows.find(r => r.role === 'Operator')).toMatchObject({ required: 0, present: 1, diff: 1 });
    expect(rows.find(r => r.role === 'Equip Operator')).toMatchObject({ present: 0, diff: -1 });
    expect(rows.find(r => r.role === 'Unassigned role')?.present).toBe(1);
    expect(total).toMatchObject({ required: 11, present: 4, diff: -7 });
    expect(fmtDiff(-7)).toBe('−7'); expect(fmtDiff(2)).toBe('+2');
  });
});
