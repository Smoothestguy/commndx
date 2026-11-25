/** Pure rules + Supabase helper for removing site stays without FK/unique collisions. */
export type LinkedEntry = { id: string; is_locked: boolean | null; invoice_id: string | null; status?: string | null };
export type SheetEntry = { visit_personnel_id: string | null; sheet_label: string };

export function planStayDeletion(input: { sheetEntries: SheetEntry[]; linkedEntries: LinkedEntry[] }): { blocked: string | null; voidIds: string[] } {
  const sheet = input.sheetEntries[0];
  if (sheet) return { blocked: `This time is on a task-order sheet (${sheet.sheet_label}). Remove it from the sheet first.`, voidIds: [] };
  if (input.linkedEntries.some(e => e.is_locked)) return { blocked: 'This time is in a locked payroll week. Reopen the week before deleting it.', voidIds: [] };
  if (input.linkedEntries.some(e => e.invoice_id || e.status === 'invoiced')) return { blocked: 'This time is already invoiced. Correct the invoice before deleting it.', voidIds: [] };
  return { blocked: null, voidIds: input.linkedEntries.map(e => e.id) };
}

/** Voided rows keep history at 0h; the DB unique index ignores them, so the stay delete can detach them safely. */
export const voidPatch = (nowIso: string) => ({ voided_at: nowIso, hours: 0, regular_hours: 0, overtime_hours: 0, billable: false, description: 'Removed site stay — history retained' });

/** Plain-English text for stay edit/delete/remove errors; never shows constraint names. */
export function friendlyTimeError(e: unknown): string {
  const raw = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : typeof e === 'string' ? e : '';
  const m = raw.toLowerCase();
  if (!raw) return 'Unable to save changes. Please try again.';
  if (m.includes('location_to_sheet_entries')) return 'This time is on a task-order sheet. Remove it from the sheet first.';
  if (m.includes('stay changed') || m.includes('refresh and retry') || m.includes('could not serialize')) return 'Someone else changed this — refresh and try again.';
  if (m.includes('location is closed')) return 'This location is closed. An admin must reopen it before times can change.';
  if (m.includes('locked') && (m.includes('week') || m.includes('time entry') || m.includes('payroll'))) return 'This time is in a locked payroll week. Reopen the week before changing it.';
  if (m.includes('invoic')) return 'This time is already invoiced. Correct the invoice before changing it.';
  if (m.includes('duplicate key') || m.includes('unique constraint')) return 'This person already has another time record for that day. Refresh and try again; if it repeats, contact an admin.';
  if (m.includes('foreign key') || m.includes('violates')) return 'This time is still linked to other records, so it couldn’t be changed. Refresh and try again.';
  if (m.includes('row-level security') || m.includes('permission denied')) return 'You don’t have permission to change this time.';
  if (m.includes('failed to fetch') || m.includes('load failed') || m.includes('network')) return 'Connection problem — check your signal and try again.';
  return raw;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = any;
/** Checks sheet links and voids linked unlocked time entries before the stay row is deleted. Throws a plain message when blocked. */
export async function prepareStayDeletion(db: Db, stayIds: string[]): Promise<() => Promise<void>> {
  const noop = async () => undefined;
  if (!stayIds.length) return noop;
  const [sheets, entries] = await Promise.all([
    db.from('location_to_sheet_entries').select('visit_personnel_id,sheet_id').in('visit_personnel_id', stayIds),
    db.from('time_entries').select('id,is_locked,invoice_id,status,hours,regular_hours,overtime_hours,billable,description').in('visit_personnel_id', stayIds).is('voided_at', null),
  ]);
  if (sheets.error) throw sheets.error;
  if (entries.error) throw entries.error;
  let sheetEntries: SheetEntry[] = [];
  if (sheets.data?.length) {
    const ids = [...new Set((sheets.data as { sheet_id: string }[]).map(r => r.sheet_id))];
    const meta = await db.from('location_to_sheets').select('id,kind,task_order_id').in('id', ids);
    const tos = meta.data?.length ? await db.from('location_task_orders').select('id,to_number,customer_ref').in('id', meta.data.map((m: { task_order_id: string }) => m.task_order_id)) : { data: [] };
    sheetEntries = (sheets.data as { visit_personnel_id: string; sheet_id: string }[]).map(r => {
      const sh = meta.data?.find((m: { id: string }) => m.id === r.sheet_id), to = tos.data?.find((t: { id: string }) => t.id === sh?.task_order_id);
      return { visit_personnel_id: r.visit_personnel_id, sheet_label: [sh?.kind ? String(sh.kind).toUpperCase() : null, to?.to_number ? `TO ${to.to_number}` : null].filter(Boolean).join(' · ') || 'task-order sheet' };
    });
  }
  const plan = planStayDeletion({ sheetEntries, linkedEntries: entries.data ?? [] });
  if (plan.blocked) throw new Error(plan.blocked);
  if (plan.voidIds.length) {
    const { error } = await db.from('time_entries').update(voidPatch(new Date().toISOString())).in('id', plan.voidIds).or('is_locked.is.null,is_locked.eq.false').is('invoice_id', null);
    if (error) throw error;
    // If the stay delete then fails, put the voided entries back exactly as they were.
    const prior = (entries.data ?? []) as Array<LinkedEntry & Record<string, unknown>>;
    return async () => { for (const e of prior) await db.from('time_entries').update({ voided_at: null, hours: e.hours, regular_hours: e.regular_hours, overtime_hours: e.overtime_hours, billable: e.billable, description: e.description }).eq('id', e.id); };
  }
  return noop;
}
