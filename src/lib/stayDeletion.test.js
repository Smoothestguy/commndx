import { expect, it } from 'bun:test';
import { planStayDeletion, prepareStayDeletion, friendlyTimeError } from './stayDeletion';

/** Minimal fake: records time_entries updates; punch_link_events never needs pre-handling (FK now SET NULL). */
function fakeDb(tables) {
  const updates = [];
  const from = (t) => {
    const q = { _t: t, _patch: null, _filters: [] };
    const chain = new Proxy(q, { get(target, k) {
      if (k === 'then') return (res) => res(target._patch ? (updates.push({ table: t, patch: target._patch, filters: target._filters }), { error: null }) : { data: tables[t] ?? [], error: null });
      if (k === 'update') return (p) => { target._patch = p; return chain; };
      return (...a) => { target._filters.push([k, ...a]); return chain; };
    } });
    return chain;
  };
  return { db: { from }, updates };
}
it('punch-link + same-day detached entry: linked entry is voided before delete so the unique rule cannot collide', async () => {
  const { db, updates } = fakeDb({
    punch_link_events: [{ id: 'ple1', visit_personnel_id: 'vp1' }],
    location_to_sheet_entries: [],
    time_entries: [{ id: 'te-linked', is_locked: false, invoice_id: null, status: 'approved', hours: 4, regular_hours: 4, overtime_hours: 0, billable: true, description: 'Site visit (auto)' }],
  });
  const restore = await prepareStayDeletion(db, ['vp1']);
  expect(updates).toHaveLength(1);
  expect(updates[0].patch).toMatchObject({ hours: 0, regular_hours: 0, overtime_hours: 0, billable: false });
  expect(typeof updates[0].patch.voided_at).toBe('string');
  expect(updates[0].filters.some(f => f[0] === 'in' && f[2].includes('te-linked'))).toBe(true);
  await restore();
  expect(updates[1].patch).toMatchObject({ voided_at: null, hours: 4, billable: true });
});
it('stay on a task-order sheet is blocked with the sheet named', () => {
  const p = planStayDeletion({ sheetEntries: [{ visit_personnel_id: 'vp1', sheet_label: 'MOBE · TO 12' }], linkedEntries: [] });
  expect(p.blocked).toBe('This time is on a task-order sheet (MOBE · TO 12). Remove it from the sheet first.');
});
it('locked or invoiced linked time blocks deletion', () => {
  expect(planStayDeletion({ sheetEntries: [], linkedEntries: [{ id: 'a', is_locked: true, invoice_id: null }] }).blocked).toMatch(/locked payroll week/);
  expect(planStayDeletion({ sheetEntries: [], linkedEntries: [{ id: 'a', is_locked: false, invoice_id: 'inv' }] }).blocked).toMatch(/invoiced/);
});
it('raw database errors become plain English without constraint names', () => {
  const dup = friendlyTimeError({ message: 'duplicate key value violates unique constraint "time_entries_personnel_project_date_nonvisit_unique"' });
  expect(dup).not.toMatch(/time_entries|constraint/);
  expect(friendlyTimeError({ message: 'update or delete on table "visit_personnel" violates foreign key constraint "location_to_sheet_entries_visit_personnel_id_fkey"' })).toBe('This time is on a task-order sheet. Remove it from the sheet first.');
  expect(friendlyTimeError(new Error('Stay changed; refresh and retry'))).toBe('Someone else changed this — refresh and try again.');
  expect(friendlyTimeError({ message: 'This location is closed' })).toMatch(/location is closed/);
});
