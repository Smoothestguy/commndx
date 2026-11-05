import { supabase } from '@/integrations/supabase/client';
import { locationDays } from './sheetApprovalRules';
import { FunctionsHttpError } from '@supabase/supabase-js';
export type LockRequest = { title: string; resolve: (reason: string | null) => void };
const listeners = new Set<(request: LockRequest | null) => void>();
let active: LockRequest | null = null;
export function subscribeSheetReopen(listener: (request: LockRequest | null) => void) { listeners.add(listener); listener(active); return () => { listeners.delete(listener); }; }
function reasonFor(title: string): Promise<string | null> {
  if (active) throw new Error('Finish the current sheet re-opening first');
  return new Promise(resolve => { active = { title, resolve: value => { active = null; listeners.forEach(l => l(null)); resolve(value); } }; listeners.forEach(l => l(active)); });
}
export async function sheetAction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('signin-sheet', { body });
  if (error) { if (error instanceof FunctionsHttpError) { const message = await error.context.json().catch(() => null); throw new Error(message?.error || 'Sheet request failed'); } throw error; }
  if (!data?.ok) throw new Error(data?.error || 'Sheet request failed'); return data;
}
export async function ensureSheetsOpen(scopes: { locationId: string; dates: string[] }[]) {
  const ids = [...new Set(scopes.map(s => s.locationId))]; if (!ids.length) return;
  const dates = [...new Set(scopes.flatMap(s => s.dates))]; if (!dates.length) return;
  const { data, error } = await supabase.from('signin_sheet_days').select('id,location_id,sheet_date').in('location_id', ids).in('sheet_date', dates).eq('status', 'locked'); if (error) throw error;
  const locked = (data || []).filter(row => scopes.some(s => s.locationId === row.location_id && s.dates.includes(row.sheet_date))); if (!locked.length) return;
  const reason = await reasonFor(locked.map(s => s.sheet_date).join(', ')); if (!reason?.trim()) throw new Error('Edit cancelled — sheet remains locked');
  for (const row of locked) await sheetAction({ action: 'reopen', sheet_day_id: row.id, reason: reason.trim() });
  window.dispatchEvent(new Event('signin-sheets-changed'));
}
export async function guardVisitDates(locationId: string, inAt: string, outAt: string | null, extraDates: string[] = []) {
  const { data, error } = await supabase.from('project_locations').select('timezone').eq('id', locationId).single(); if (error) throw error;
  await ensureSheetsOpen([{ locationId, dates: [...extraDates, ...locationDays(inAt, outAt, data.timezone || 'America/Chicago')] }]);
}
export async function guardTimeEntries(ids: string[], proposed?: { location_id?: string | null; entry_date?: string }) {
  if (!ids.length) return;
  const { data, error } = await supabase.from('time_entries').select('location_id,entry_date').in('id', ids); if (error) throw error;
  await ensureSheetsOpen((data || []).flatMap(r => { const scopes = r.location_id ? [{ locationId: r.location_id, dates: [r.entry_date] }] : []; const locationId = proposed?.location_id ?? r.location_id; if (locationId && proposed?.entry_date) scopes.push({ locationId, dates: [proposed.entry_date] }); return scopes; }));
}
