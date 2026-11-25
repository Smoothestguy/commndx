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

import { pickExpected, resolveRole, isShortStay, overlappingStays } from './staffingBreakdown';
describe('staffing accuracy', () => {
  const e = (day, technicians) => ({ day, supervisors: 0, technicians, operators: 0 });
  it('carry-forward picks the latest prior day, within window', () => {
    const rows = [e('2026-11-18', 10), e('2026-11-20', 16), e('2026-11-26', 3)];
    expect(pickExpected(rows, '2026-11-24')?.day).toBe('2026-11-20');
    expect(pickExpected(rows, '2026-11-26')?.technicians).toBe(3);
    expect(pickExpected(rows, '2026-11-17')).toBe(null);
    expect(pickExpected(rows, '2026-11-24', { end: '2026-11-22' })).toBe(null);
    expect(pickExpected(rows, '2026-11-19', { start: '2026-11-19' })).toBe(null);
  });
  it('role fallback: roster, then latest history, then none', () => {
    const h = [{ role_label: 'Tech', assigned_at: '2026-11-01' }, { role_label: 'Supervisor', assigned_at: '2026-11-10' }, { role_label: null, assigned_at: '2026-11-20' }];
    expect(resolveRole('Operator', h)).toBe('Operator');
    expect(resolveRole(null, h)).toBe('Supervisor');
    expect(resolveRole(' ', [])).toBe(null);
  });
  it('ignores stays under 5 minutes', () => {
    expect(isShortStay({ in_at: '2026-11-24T21:08:17Z', out_at: '2026-11-24T21:08:18Z' })).toBe(true);
    expect(isShortStay({ in_at: '2026-11-24T21:00:00Z', out_at: '2026-11-24T21:05:00Z' })).toBe(false);
    expect(isShortStay({ in_at: '2026-11-24T21:00:00Z', out_at: null })).toBe(false);
  });
  it('flags >15 min overlap, not back-to-back', () => {
    const mine = [{ in_at: '2026-11-23T12:00:00Z', out_at: '2026-11-24T00:00:00Z' }];
    expect(overlappingStays(mine, [{ in_at: '2026-11-23T12:00:00Z', out_at: '2026-11-24T00:00:00Z' }]).length).toBe(1);
    expect(overlappingStays(mine, [{ in_at: '2026-11-24T00:00:00Z', out_at: '2026-11-24T06:00:00Z' }]).length).toBe(0);
    expect(overlappingStays(mine, [{ in_at: '2026-11-23T23:50:00Z', out_at: '2026-11-24T06:00:00Z' }]).length).toBe(0);
    expect(overlappingStays(mine, [{ in_at: '2026-11-23T23:40:00Z', out_at: '2026-11-24T06:00:00Z' }]).length).toBe(1);
  });
});
