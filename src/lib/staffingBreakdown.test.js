import { describe, it, expect } from 'bun:test';
import { staffingBreakdown, dailyStaffingBreakdown, fmtDiff } from './staffingBreakdown';
describe('staffingBreakdown', () => {
  it('present minus required, case-insensitive, distinct people, unmatched separate', () => {
    const { rows, total } = staffingBreakdown([{ role_label: 'Tech', headcount_needed: 10 }, { role_label: 'Equip Operator', headcount_needed: 1 }],
      [{ id: 'a', role: 'tech ', present: true }, { id: 'a', role: 'Tech', present: true }, { id: 'b', role: 'Tech', present: true }, { id: 'c', role: 'Operator', present: true }, { id: 'd', role: null, present: true }, { id: 'e', role: 'Tech', present: false }]);
    expect(rows.find(r => r.role === 'Tech')).toMatchObject({ required: 10, present: 2, diff: -8 });
    expect(rows.find(r => r.role === 'Operator')).toMatchObject({ required: 0, present: 1, diff: 1 });
    expect(rows.find(r => r.role === 'Equip Operator')).toMatchObject({ present: 0, diff: -1 });
    expect(rows.find(r => r.role === 'No role set')?.present).toBe(1);
    expect(total).toMatchObject({ required: 11, present: 4, diff: -7 });
    expect(fmtDiff(-7)).toBe('−7'); expect(fmtDiff(2)).toBe('+2');
  });
});

describe('daily customer-sheet fallback', () => {
  it('maps sup, tech and oper case-insensitively and counts each bucket once', () => {
    const data = dailyStaffingBreakdown([], [
      { id: 'a', role: 'SUP lead', present: true }, { id: 'b', role: 'Field supervisor', present: true },
      { id: 'c', role: 'TECH II', present: true }, { id: 'c', role: 'Technician', present: true },
      { id: 'd', role: 'Equipment OPERator', present: true }, { id: 'e', role: 'Tech', present: false },
    ], { supervisors: 2, technicians: 4, operators: 1 });
    expect(data.source).toBe('customer'); expect(data.hasRequired).toBe(true);
    expect(data.rows).toEqual([
      { role: 'Supervisor', required: 2, present: 2, diff: 0 },
      { role: 'Technician', required: 4, present: 1, diff: -3 },
      { role: 'Operator', required: 1, present: 1, diff: 0 },
    ]);
    expect(data.total).toMatchObject({ required: 7, present: 4, diff: -3 });
  });
  it('shows required buckets even without a matching present role', () => {
    const data = dailyStaffingBreakdown([], [{ id: 'a', role: null, present: true }], { supervisors: 2, technicians: 0, operators: 0 });
    expect(data.rows).toEqual([{ role: 'Supervisor', required: 2, present: 0, diff: -2 }, { role: 'No role set', required: 0, present: 1, diff: 1 }]);
  });
  it('always prefers existing site requirements over customer numbers', () => {
    const data = dailyStaffingBreakdown([{ role_label: 'Tech II', headcount_needed: 3 }], [{ id: 'a', role: 'tech ii', present: true }], { supervisors: 2, technicians: 20, operators: 1 });
    expect(data.source).toBe('site'); expect(data.total).toMatchObject({ required: 3, present: 1, diff: -2 });
  });
  it('does not fall back when site requirements exist but are zero', () => {
    const data = dailyStaffingBreakdown([{ role_label: 'Tech', headcount_needed: 0 }], [], { supervisors: 2, technicians: 20, operators: 1 });
    expect(data.source).toBe('site'); expect(data.hasRequired).toBe(false); expect(data.total.required).toBe(0);
  });
  it('hides comparison when the viewed day has no expected numbers', () => {
    for (const expected of [null, { supervisors: 0, technicians: 0, operators: 0 }]) {
      const data = dailyStaffingBreakdown([], [{ id: 'a', role: 'Tech', present: true }], expected);
      expect(data.source).toBeNull(); expect(data.hasRequired).toBe(false); expect(data.total.present).toBe(1);
    }
  });
});
