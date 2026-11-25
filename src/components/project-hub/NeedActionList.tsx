import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { localDay, localTime, midnight, nextDay } from '@/lib/signinSheets';
import { needHint } from '@/lib/needAction';

export type DayResolution = { id: string; personnel_id: string; reason: 'day_off' | 'other_site' };

/** Day off / Other site marks — never worked time, hours, headcount or billing. */
export function useDayResolutions(locationId: string, day: string) {
  return useQuery({ queryKey: ['location-day-resolutions', locationId, day], queryFn: async () => {
    const r = await supabase.from('location_day_resolutions').select('id,personnel_id,reason').eq('location_id', locationId).eq('day', day);
    if (r.error) throw r.error; return (r.data ?? []) as DayResolution[];
  } });
}

type Person = { id: string; name: string; role: string | null };
const hhmm = (iso: string, tz: string) => localTime(iso, tz).replace(':', '');

export function NeedActionList({ locationId, day, tz, people, resolutions, linkEvents, canWrite, onWorked, onDemob }: {
  locationId: string; day: string; tz: string; people: Person[]; resolutions: DayResolution[];
  linkEvents: { personnel_id: string; opened_at: string }[]; canWrite: boolean;
  onWorked: (ids: string[]) => Promise<void>; onDemob: (id: string) => Promise<void>;
}) {
  const qc = useQueryClient();
  const [sel, setSel] = useState<string[]>([]), [busy, setBusy] = useState(false);
  const ids = people.map(p => p.id);
  const hints = useQuery({ queryKey: ['need-action-hints', locationId, day, ids.join(',')], enabled: ids.length > 0, queryFn: async () => {
    const base = Date.parse(`${day}T12:00:00Z`), end = new Date(midnight(nextDay(day), tz)).toISOString();
    const [near, last] = await Promise.all([
      supabase.from('personnel_location_trail').select('personnel_id,location_id,in_at').in('personnel_id', ids).neq('location_id', locationId).gte('in_at', new Date(base - 864e5).toISOString()).lte('in_at', new Date(base + 864e5).toISOString()).order('in_at'),
      supabase.from('personnel_location_trail').select('personnel_id,in_at').in('personnel_id', ids).lt('in_at', end).order('in_at', { ascending: false }).limit(2000),
    ]);
    if (near.error) throw near.error; if (last.error) throw last.error;
    const other = (near.data ?? []).filter(r => r.in_at && localDay(r.in_at, tz) === day);
    const locIds = [...new Set(other.map(r => r.location_id).filter(Boolean))] as string[];
    const names = locIds.length ? await supabase.from('project_locations').select('id,name').in('id', locIds) : { data: [] as { id: string; name: string }[] };
    return { other, last: last.data ?? [], names: Object.fromEntries((names.data ?? []).map(n => [n.id, n.name])) as Record<string, string> };
  } });
  const hintFor = useMemo(() => (id: string) => {
    const o = hints.data?.other.find(r => r.personnel_id === id);
    const link = linkEvents.find(e => e.personnel_id === id);
    const l = hints.data?.last.find(r => r.personnel_id === id);
    return needHint(day, { otherSite: o ? { name: hints.data!.names[o.location_id ?? ''] ?? 'another site', time: hhmm(o.in_at!, tz) } : null, openedLink: link ? hhmm(link.opened_at, tz) : null, lastDay: l?.in_at ? localDay(l.in_at, tz) : null });
  }, [hints.data, linkEvents, day, tz]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['location-day-resolutions', locationId, day] });
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); setSel(s => s.filter(id => people.some(p => p.id === id))); } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed'); } finally { setBusy(false); } };
  const resolve = (pids: string[], reason: 'day_off' | 'other_site') => run(async () => {
    const r = await supabase.from('location_day_resolutions').upsert(pids.map(personnel_id => ({ location_id: locationId, personnel_id, day, reason })), { onConflict: 'location_id,personnel_id,day' });
    if (r.error) throw r.error; setSel([]); await refresh();
  });
  const undo = () => run(async () => {
    const r = await supabase.from('location_day_resolutions').delete().eq('location_id', locationId).eq('day', day).in('id', resolutions.map(x => x.id));
    if (r.error) throw r.error; await refresh();
  });
  const actions = (pids: string[], otherHint = false) => canWrite && <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
    <Button size="sm" className="h-10" disabled={busy} onClick={() => run(() => onWorked(pids))}>Worked</Button>
    <Button size="sm" variant="outline" className="h-10" disabled={busy} onClick={() => resolve(pids, 'day_off')}>Day off</Button>
    <Button size="sm" variant={otherHint ? 'secondary' : 'outline'} className={cn('h-10', otherHint && 'ring-2 ring-primary')} disabled={busy} onClick={() => resolve(pids, 'other_site')}>Other site</Button>
    <Button size="sm" variant="outline" className="h-10 text-destructive" disabled={busy} onClick={() => run(async () => { for (const id of pids) await onDemob(id); })}>Demobilize</Button>
  </div>;
  if (!people.length && !resolutions.length) return null;
  return <section aria-label="Need action" className="space-y-2">
    {people.length > 0 && <div className="rounded-md border border-warning/50 bg-warning/5 p-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {canWrite && <Checkbox aria-label="Select all" checked={sel.length === people.length} onCheckedChange={v => setSel(v ? ids : [])} />}
        <p className="text-sm font-medium">Need action · {people.length}</p>
        {sel.length > 0 && <span className="text-xs text-muted-foreground">{sel.length} selected</span>}
      </div>
      {sel.length > 0 && actions(sel)}
      <ul className="divide-y">{people.map(p => { const h = hintFor(p.id); return <li key={p.id} className="py-2 flex flex-col gap-1.5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {canWrite && <Checkbox className="mt-1" aria-label={`Select ${p.name}`} checked={sel.includes(p.id)} onCheckedChange={v => setSel(s => v ? [...s, p.id] : s.filter(x => x !== p.id))} />}
          <div className="min-w-0"><p className="text-sm font-medium truncate">{p.name || 'Unnamed'}{p.role && <span className="text-muted-foreground font-normal"> · {p.role}</span>}</p>
            <p className={cn('text-xs', h.warn ? 'text-warning' : 'text-muted-foreground')}>{hints.isLoading ? '…' : h.text}</p></div>
        </div>
        {actions([p.id], h.kind === 'other_site')}
      </li>; })}</ul>
    </div>}
    {resolutions.length > 0 && <p className="text-xs text-muted-foreground">Resolved today: {resolutions.length}{canWrite && <> · <Button variant="link" size="sm" className="h-auto p-0" disabled={busy} onClick={undo}>Undo</Button></>}</p>}
  </section>;
}
