import { supabase } from '@/integrations/supabase/client';

export type ExpectedDay = { supervisors: number; technicians: number; operators: number; source: string | null };
export const expectedTotal = (e?: ExpectedDay | null) => e ? e.supervisors + e.technicians + e.operators : null;

/** Customer-sheet expected headcount for one location/day; null when none (or not visible to this role). */
export async function loadExpectedDay(locationId: string, day: string): Promise<ExpectedDay | null> {
  const { data, error } = await supabase.from('location_day_expected').select('supervisors,technicians,operators,source').eq('location_id', locationId).eq('day', day).maybeSingle();
  if (error) return null;
  return data;
}

/** Day headcount pieces for PDFs: timed people (from sheet rows) + presence-only without a timed entry. */
export async function saveExpectedDay(locationId: string, day: string, e: ExpectedDay) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('location_day_expected').upsert({ location_id: locationId, day, ...e, updated_by: u.user?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: 'location_id,day' });
  if (error) throw error;
}
