import { it, expect } from 'bun:test';
import { roleGaps, worstRole, attention, sortByAttention } from './commandCenter';

it('uses task-order position levels over requirements and flags over as red', () => {
  const gaps = roleGaps([{ line_kind: 'position', label: 'Operator', authorized: 16 }, { line_kind: 'asset', label: 'Truck', authorized: 6 }, { line_kind: 'position', label: 'Supervisor', authorized: 4 }],
    { Operator: { needed: 0, assigned: 17 }, Supervisor: { needed: 0, assigned: 3 } });
  expect(gaps).toEqual([
    { role: 'Operator', authorized: 16, actual: 17, over: 1, under: 0 },
    { role: 'Supervisor', authorized: 4, actual: 3, over: 0, under: 1 },
  ]);
  expect(worstRole(gaps)).toEqual({ severity: 'red', label: 'Operator +1 OVER' });
});

it('falls back to requirements and reports amber under', () => {
  const gaps = roleGaps(null, { Operator: { needed: 5, assigned: 3 } });
  expect(worstRole(gaps)).toEqual({ severity: 'amber', label: 'Operator −2 UNDER' });
});

it('asset shortages need attention; sort puts attention first then alphabetical', () => {
  const base = { staffSeverity: 'ok', assetUnder: 0, assetOver: 0, late: 0, joinPending: 0, openPunches: 0, pendingTOs: 0, extPending: 0, openRequests: 0 };
  expect(attention({ ...base, assetUnder: 6 })).toBe('amber');
  expect(attention({ ...base, openPunches: 13 })).toBe('ok');
  expect(sortByAttention([{ name: 'B', severity: 'ok' }, { name: 'A', severity: 'ok' }, { name: 'Z', severity: 'red' }, { name: 'C', severity: 'amber' }]).map(r => r.name)).toEqual(['Z', 'C', 'A', 'B']);
});
