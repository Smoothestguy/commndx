import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { homeRows, useHomeLocations } from '@/hooks/useHomeOperations';
import { demobilizedFilter } from '@/integrations/supabase/hooks/useLocationStaffing';
import { todaySites, noRecentClockIns, type TodayStay, type Attention } from '@/lib/phoneToday';

const chunks = <T,>(a: T[], n = 150) => Array.from({ length: Math.ceil(a.length / n) }, (_, k) => a.slice(k * n, k * n + n));
const TRAIL = 'visit_personnel_id,personnel_id,location_id,location_name,first_name,last_name,in_at,out_at,signature_url';

/** Manager phone Today: one batched read set for every active site (read-only), refreshed every 60s while visible. */
export function usePhoneToday() {
  const scope = useHomeLocations(), { user } = useAuth();
  const locations = scope.data?.locations ?? [];
  const ids = locations.map(l => l.id).sort();
  const q = useQuery({ queryKey: ['phone-today', ids], enabled: !!scope.data, refetchInterval: 60000, staleTime: 30000, queryFn: async () => {
    if (!ids.length) return { cards: [], attention: [] as Attention[], onSheet: 0, onboarding: [] as Attention[] };
    const since3 = new Date(Date.now() - 3 * 864e5).toISOString(), since14 = new Date(Date.now() - 14 * 864e5).toISOString();
    const minDay = since3.slice(0, 10);
    const [trail, rosterAll, resolutions, presence, requirements, expected, alerts] = await Promise.all([
      homeRows(o => supabase.from('personnel_location_trail').select(TRAIL).in('location_id', ids).or(`out_at.is.null,in_at.gte.${since3}`).order('visit_personnel_id').range(o, o + 499)),
      homeRows(o => supabase.from('location_assignments').select('location_id,personnel_id,assigned_at,unassigned_at').in('location_id', ids).eq('status', 'active').order('id').range(o, o + 499)),
      homeRows(o => supabase.from('location_day_resolutions').select('location_id,personnel_id,day').in('location_id', ids).gte('day', minDay).order('id').range(o, o + 499)),
      homeRows(o => supabase.from('timesheet_presence_signatures').select('location_id,personnel_id,sign_date').in('location_id', ids).gte('sign_date', minDay).order('id').range(o, o + 499)),
      homeRows(o => supabase.from('location_requirements').select('location_id,role_label,headcount_needed').in('location_id', ids).order('id').range(o, o + 499)),
      homeRows(o => supabase.from('location_day_expected').select('location_id,day,supervisors,technicians,operators').in('location_id', ids).order('id').range(o, o + 499)),
      user ? supabase.from('admin_notifications').select('id,title,message,link_url,related_id,created_at').eq('user_id', user.id).eq('notification_type', 'onboarding_delivery_alert').eq('is_read', false).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    ]);
    const isDemob = await demobilizedFilter(rosterAll);
    const now = Date.now();
    const roster = rosterAll.filter(r => !isDemob(r) && (!r.assigned_at || Date.parse(r.assigned_at) <= now) && (!r.unassigned_at || Date.parse(r.unassigned_at) > now));
    const people = [...new Set([...roster.map(r => r.personnel_id), ...trail.map(t => t.personnel_id).filter(Boolean) as string[]])];
    // Same people at any site (incl. outside this set) for overlap and last-clock-in checks.
    const wide = (await Promise.all(chunks(people).map(c => homeRows(o => supabase.from('personnel_location_trail').select(TRAIL).in('personnel_id', c).gte('in_at', since14).order('visit_personnel_id').range(o, o + 499))))).flat() as TodayStay[];
    const all = new Map<string, TodayStay>(); for (const t of [...trail as TodayStay[], ...wide]) all.set(t.visit_personnel_id, t);
    const merged = [...all.values()];
    const result = todaySites({ locations, projects: scope.data?.projects ?? [], trail: merged, roster, resolutions, presence, requirements, expected: expected as never, now });
    const names: Record<string, string> = {};
    for (const t of merged) if (t.personnel_id) names[t.personnel_id] = [t.first_name, t.last_name].filter(Boolean).join(' ');
    const idleRaw = noRecentClockIns(locations, roster, merged, names, now);
    const unknown = idleRaw.map(a => a.key.slice(5)).filter(id => !names[id]);
    if (unknown.length) { const d = await supabase.from('personnel_directory').select('id,first_name,last_name').in('id', unknown.slice(0, 200)); for (const p of d.data ?? []) if (p.id) names[p.id] = [p.first_name, p.last_name].filter(Boolean).join(' '); }
    const idle = noRecentClockIns(locations, roster, merged, names, now);
    const seen = new Set<string>();
    const onboarding: Attention[] = ((alerts as { data: { id: string; title: string; message: string; link_url: string | null; related_id: string | null }[] | null }).data ?? []).filter(a => { const k = a.related_id || a.id; if (seen.has(k)) return false; seen.add(k); return true; }).map(a => ({ key: `onb:${a.related_id || a.id}`, kind: 'onboarding', text: a.title, detail: a.message, to: a.link_url || '/personnel' }));
    return { ...result, attention: [...result.attention, ...idle], onboarding };
  } });
  return { scope, q };
}
