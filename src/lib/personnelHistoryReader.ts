import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { emptyPersonnelHistory, personnelOnboardingStatus, type PersonnelHistory } from './personnelHistory';
import { protectedPersonnelTables } from './personnelCascadeCoverage';

type HistoryTable = keyof typeof protectedPersonnelTables | 'time_entries' | 'location_attendance' | 'personnel_documents' | 'personnel_w9_forms' | 'personnel_payments' | 'personnel_project_assignments' | 'location_assignments' | 'personnel_onboarding_tokens' | 'personnel';
type HistoryRow = { id?: string; personnel_id?: string; entry_date?: string; status?: string; unassigned_at?: string | null; project_id?: string; location_id?: string; onboarding_status?: string | null; onboarding_completed_at?: string | null; used_at?: string | null; revoked_at?: string | null; created_at?: string };

export async function requirePersonnelHistoryManager() {
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) throw new Error('Sign in to check personnel history.');
  const roles = await supabase.from('user_roles').select('role').eq('user_id', auth.user.id);
  if (roles.error || !roles.data?.some(r => r.role === 'admin' || r.role === 'manager')) throw new Error('Only admins and managers can check or delete personnel.');
}

async function readRows(table: HistoryTable, columns: string, ids: string[]): Promise<HistoryRow[]> {
  const rows: HistoryRow[] = [];
  // Batch IDs and paginate every table; never assume the API's first 1,000 rows are complete.
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    for (let offset = 0; ; offset += 500) {
      const result = await (supabase as SupabaseClient).from(table).select(columns).in(table === 'personnel' ? 'id' : 'personnel_id', batch).order('id').range(offset, offset + 499);
      if (result.error) throw new Error(`Cannot check ${table.replace(/_/g, ' ')}. Deletion is unavailable until the check succeeds.`);
      const page = result.data as unknown as HistoryRow[];
      rows.push(...page);
      if (page.length < 500) break;
    }
  }
  return rows;
}

export async function readPersonnelHistories(inputIds: string[]): Promise<Record<string, PersonnelHistory>> {
  await requirePersonnelHistoryManager();
  const ids = [...new Set(inputIds)].sort();
  if (!ids.length) return {};
  const relatedTables = Object.keys(protectedPersonnelTables) as (keyof typeof protectedPersonnelTables)[];
  const [people, times, attendance, documents, w9, payments, projects, locations, tokens, related] = await Promise.all([
    readRows('personnel', 'id,onboarding_status,onboarding_completed_at', ids),
    readRows('time_entries', 'id,personnel_id,entry_date', ids),
    readRows('location_attendance', 'id,personnel_id', ids),
    readRows('personnel_documents', 'id,personnel_id', ids),
    readRows('personnel_w9_forms', 'id,personnel_id', ids),
    readRows('personnel_payments', 'id,personnel_id', ids),
    readRows('personnel_project_assignments', 'id,personnel_id,project_id,status,unassigned_at', ids),
    readRows('location_assignments', 'id,personnel_id,location_id,status,unassigned_at', ids),
    readRows('personnel_onboarding_tokens', 'id,personnel_id,created_at,used_at,revoked_at', ids),
    Promise.all(relatedTables.map(table => readRows(table, 'id,personnel_id', ids))),
  ]);
  if (people.length !== ids.length) throw new Error('Some personnel records could not be checked. Deletion is unavailable.');
  const result = Object.fromEntries(ids.map(id => [id, emptyPersonnelHistory()]));
  relatedTables.forEach((table,index) => { for (const row of related[index]) if (row.personnel_id && result[row.personnel_id]) result[row.personnel_id].related[table]++; });
  const counts = [[attendance,'attendance'],[documents,'documents'],[w9,'w9Forms'],[payments,'payments'],[projects,'projectAssignments'],[locations,'locationAssignments']] as const;
  for (const [rows,key] of counts) for (const row of rows) if (row.personnel_id && result[row.personnel_id]) result[row.personnel_id][key]++;
  for (const row of times) {
    const h = row.personnel_id ? result[row.personnel_id] : undefined;
    if (!h) continue;
    h.timeEntries++;
    if (row.entry_date && (!h.lastWorked || row.entry_date > h.lastWorked)) h.lastWorked = row.entry_date;
  }
  for (const person of people) {
    if (!person.id) continue;
    const h = result[person.id];
    h.activeProjects = new Set(projects.filter(r => r.personnel_id === person.id && r.status === 'active' && !r.unassigned_at).map(r => r.project_id)).size;
    h.activeLocations = new Set(locations.filter(r => r.personnel_id === person.id && r.status === 'active' && !r.unassigned_at).map(r => r.location_id)).size;
    h.onboarding = personnelOnboardingStatus(person.onboarding_status ?? null, person.onboarding_completed_at ?? null, tokens.filter(r => r.personnel_id === person.id).map(r => ({created_at: r.created_at ?? '', used_at: r.used_at ?? null, revoked_at: r.revoked_at ?? null})));
  }
  return result;
}