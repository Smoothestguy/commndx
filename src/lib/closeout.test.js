import { it, expect } from 'bun:test';
import { demobLines, closeoutBlocked, openLocations, projectSummary } from './closeout';

it('demob task order zeroes every remaining authorized position and asset', () => {
  expect(demobLines([{ line_kind: 'position', label: 'Operator', authorized: 16 }, { line_kind: 'asset', label: 'Truck', authorized: 6 }, { line_kind: 'position', label: 'Supervisor', authorized: 0 }]))
    .toEqual([{ line_kind: 'position', label: 'Operator', qty_delta: -16 }, { line_kind: 'asset', label: 'Truck', qty_delta: -6 }]);
});
it('closing is blocked by open punches, pending field requests or join requests', () => {
  expect(closeoutBlocked({ openPunches: 0, fieldRequests: 0, joinRequests: 0 })).toBe(false);
  expect(closeoutBlocked({ openPunches: 1, fieldRequests: 0, joinRequests: 0 })).toBe(true);
  expect(closeoutBlocked({ openPunches: 0, fieldRequests: 1, joinRequests: 0 })).toBe(true);
  expect(closeoutBlocked({ openPunches: 0, fieldRequests: 0, joinRequests: 2 })).toBe(true);
});
it('project close-out is blocked by any non-closed location, including inactive', () => {
  expect(openLocations([{ status: 'closed' }, { status: 'inactive' }, { status: 'active' }]).length).toBe(2);
  expect(openLocations([{ status: 'closed' }]).length).toBe(0);
});
it('project summary totals hours and spans dates', () => {
  expect(projectSummary([{ mobe_date: '2026-11-03', demobe_date: '2026-11-07', closeout_date: '2026-11-06' }, { mobe_date: '2026-11-04', demobe_date: null }], [{ entry_date: '2026-11-04', hours: 12 }, { entry_date: '2026-11-05', hours: '11.5' }]))
    .toEqual({ start: '2026-11-03', end: '2026-11-06', hours: 23.5, locations: 2 });
});
