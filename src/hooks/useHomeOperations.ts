import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { localDay, midnight, nextDay } from '@/lib/signinSheets';
import { signatureCounts } from '@/lib/homeOperations';
import type { ProjectLocation } from '@/integrations/supabase/hooks/useProjectLocations';

export async function homeRows<T>(make: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let o = 0; ; o += 500) {
    const { data, error } = await make(o); if (error) throw error;
    out.push(...data ?? []); if ((data ?? []).length < 500) return out;
  }
}
export function useHomeLocations() {
  return useQuery({ queryKey: ['project-locations', 'home-active'], staleTime: 30000, refetchInterval: 60000, queryFn: async () => {
    const projects = await homeRows(o => supabase.from('projects').select('id,name').eq('status', 'active').is('archived_at', null).order('id').range(o, o + 499));
    if (!projects.length) return { projects, locations: [] as ProjectLocation[] };
    const locations = await homeRows(o => supabase.from('project_locations').select('*').in('project_id', projects.map(p => p.id)).eq('status', 'active').order('id').range(o, o + 499));
    return { projects, locations: locations as ProjectLocation[] };
  } });
}
export function useHomeDaily(locations: ProjectLocation[]) {
  const ids = locations.map(l => l.id).sort();
  const now = new Date().toISOString();
  const dates = locations.map(l => `${l.id}:${localDay(now, l.timezone || 'America/Chicago')}`).sort();
  return useQuery({ queryKey: ['home-daily', dates], enabled: ids.length > 0, refetchInterval: 60000, queryFn: async () => {
    const since = new Date(Date.now() - 2 * 86400000).toISOString();
    const [trail, entries, requests] = await Promise.all([
      homeRows(o => supabase.from('personnel_location_trail').select('visit_personnel_id,personnel_id,location_id,in_at,out_at,signature_url').in('location_id', ids).gte('in_at', since).order('visit_personnel_id').range(o, o + 499)),
      homeRows(o => supabase.from('time_entries').select('id,personnel_id,location_id,entry_date,hours,clock_in_at,clock_out_at,visit_personnel_id').in('location_id', ids).gte('entry_date', since.slice(0,10)).order('id').range(o, o + 499)),
      homeRows(o => supabase.from('location_requests').select('id,location_id,kind,label,qty,note,status,created_at').in('location_id', ids).in('status', ['open', 'accepted']).order('id').range(o, o + 499)),
    ]);
    const byLocation: Record<string, { missing: number; total: number; requests: number; hours: number; onSite: number }> = {};
    const people = new Set<string>();
    for (const l of locations) {
      const zone = l.timezone || 'America/Chicago', day = localDay(new Date().toISOString(), zone);
      const start = midnight(day, zone), end = midnight(nextDay(day), zone);
      const dayRows = trail.filter(t => t.location_id === l.id && t.in_at && localDay(t.in_at, zone) === day);
      const open = trail.filter(t => t.location_id === l.id && !t.out_at);
      for (const t of open) if (t.personnel_id) people.add(t.personnel_id);
      // Canonical payroll segments: only closed stays, prorated to this location's operational day.
      const hours = entries.filter(e => e.location_id === l.id).reduce((n, e) => {
        if (e.clock_in_at && e.clock_out_at) {
          const a = Date.parse(e.clock_in_at), b = Date.parse(e.clock_out_at);
          const overlap = Math.max(0, Math.min(end,b) - Math.max(start,a));
          return n + (b > a ? Number(e.hours || 0) * overlap / (b-a) : 0);
        }
        return n + (!e.clock_in_at && !e.visit_personnel_id && e.entry_date === day ? Number(e.hours || 0) : 0);
      }, 0);
      const signature = signatureCounts(dayRows.filter(t => t.personnel_id).map(t => ({ personnel_id: t.personnel_id as string, signature_url: t.signature_url })));
      byLocation[l.id] = { ...signature, requests: requests.filter(r => r.location_id === l.id && r.status === 'open').length, hours, onSite: new Set(open.map(t => t.personnel_id)).size };
    }
    return { byLocation, people: people.size, hours: Object.values(byLocation).reduce((n,r) => n+r.hours,0), requests };
  } });
}