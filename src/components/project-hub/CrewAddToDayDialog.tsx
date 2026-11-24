import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Time24Input } from '@/components/ui/time24-input';
import { Loader2 } from 'lucide-react';
import { useLogManualTime } from '@/integrations/supabase/hooks/useFieldMode';
import { useProject } from '@/integrations/supabase/hooks/useProjects';
import { useProjectLocations } from '@/integrations/supabase/hooks/useProjectLocations';
import type { LocationAssignment } from '@/integrations/supabase/hooks/useLocationStaffing';
import { OverlapBypassControls } from './OverlapBypassControls';
import { manualTimeRange, scheduledShift } from '@/lib/manualTime';

/** Location-scoped backfill: only this location's crew (never the project-wide roster). */
export function CrewAddToDayDialog({ projectId, locationId, timezone, day, assignments, excludeIds, onClose }: { projectId: string; locationId: string; timezone: string; day: string; assignments: LocationAssignment[]; excludeIds: Set<string>; onClose: (added: number) => void }) {
  const { data: project } = useProject(projectId);
  const { data: locations } = useProjectLocations(projectId);
  const location = locations?.find(l => l.id === locationId);
  const save = useLogManualTime(projectId);
  const people = useMemo(() => {
    const seen = new Set<string>();
    return assignments.filter(a => !a.demobilized && !excludeIds.has(a.personnel_id) && !seen.has(a.personnel_id) && seen.add(a.personnel_id))
      .map(a => ({ id: a.personnel_id, name: [a.personnel?.first_name, a.personnel?.last_name].filter(Boolean).join(' ') || 'Unnamed', role: a.role_label }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assignments, excludeIds]);
  const [search, setSearch] = useState(''), [selected, setSelected] = useState<string[]>(() => people.map(p => p.id)), [completed, setCompleted] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [shift, setShift] = useState<'day' | 'night'>('day'), [tin, setTin] = useState(''), [tout, setTout] = useState(''), [outDay, setOutDay] = useState(day);
  useEffect(() => setOutDay(day), [day]);
  const visible = people.filter(p => !search.trim() || `${p.name} ${p.role ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const allVisible = visible.length > 0 && visible.every(p => selected.includes(p.id));
  const range = manualTimeRange(day, tin, tout, timezone, outDay);
  const locked = busy || !!completed.length;
  const run = async () => {
    if (!range) return; setBusy(true); setError(''); const done = [...completed];
    try {
      for (const id of selected.filter(id => !done.includes(id))) { await save.mutateAsync({ personnel_id: id, location_id: locationId, day, in_at: range.inAt, out_at: range.outAt, note: 'Backfill from location crew' }); done.push(id); setCompleted([...done]); }
      onClose(done.length);
    } catch (e) { setError(`${done.length} saved; remaining not saved. ${e instanceof Error ? e.message : 'Try again.'}`); } finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={v => { if (!v && !busy) onClose(completed.length); }}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}>
    <DialogHeader><DialogTitle>Add crew to {day}{location?.name ? ` · ${location.name}` : ''}</DialogTitle></DialogHeader>
    <div><Label htmlFor="crew-add-date">Date</Label><Input id="crew-add-date" type="date" value={day} readOnly disabled /></div>
    <div className="flex gap-2"><Select value={shift} disabled={locked} onValueChange={v => setShift(v === 'night' ? 'night' : 'day')}><SelectTrigger aria-label="Scheduled shift"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">Day shift</SelectItem><SelectItem value="night">Night shift</SelectItem></SelectContent></Select><Button variant="outline" disabled={locked} onClick={() => { const s = scheduledShift(day, shift, location, project); setTin(s.timeIn); setTout(s.timeOut); setOutDay(s.outDay); }}>Use shift times</Button></div>
    <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="crew-add-in">Time in (24h)</Label><Time24Input id="crew-add-in" step={60} value={tin} disabled={locked} onChange={e => setTin(e.target.value)} /></div><div><Label htmlFor="crew-add-out">Time out (24h)</Label><Time24Input id="crew-add-out" step={60} value={tout} disabled={locked} onChange={e => setTout(e.target.value)} /></div></div>
    <div><Label htmlFor="crew-add-out-date">Time out date</Label><Input id="crew-add-out-date" type="date" min={day} value={outDay} disabled={locked} onChange={e => setOutDay(e.target.value)} /></div>
    <p className="text-xs text-muted-foreground">{range ? `${range.hours.toFixed(2)} hours · ` : ''}{timezone}</p>
    <div className="flex items-center gap-2"><Input placeholder="Search crew" aria-label="Search crew" value={search} onChange={e => setSearch(e.target.value)} className="h-8" /><Button size="sm" variant="ghost" disabled={busy || !visible.length} onClick={() => setSelected(s => allVisible ? s.filter(id => completed.includes(id) || !visible.some(p => p.id === id)) : [...new Set([...s, ...visible.map(p => p.id)])])}>{allVisible ? 'Select none' : 'Select all'}</Button></div>
    {!people.length ? <p className="text-sm text-muted-foreground">Everyone on this location's crew is already on this day.</p> : <div className="divide-y max-h-64 overflow-y-auto">{visible.map(p => <label key={p.id} className="flex gap-3 items-center py-3 text-sm"><Checkbox checked={selected.includes(p.id)} disabled={busy || completed.includes(p.id)} onCheckedChange={v => setSelected(s => v ? [...s, p.id] : s.filter(id => id !== p.id))} /><span>{p.name}</span>{p.role && <span className="text-muted-foreground">{p.role}</span>}{completed.includes(p.id) && <span className="ml-auto text-success">Saved</span>}</label>)}</div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <OverlapBypassControls error={error} timezone={timezone} disabled={busy} onActivated={() => void run()} />
    <DialogFooter><Button variant="outline" disabled={busy} onClick={() => onClose(completed.length)}>Cancel</Button><Button disabled={busy || !range || !selected.some(id => !completed.includes(id))} onClick={() => void run()}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Add {selected.filter(id => !completed.includes(id)).length} to day</Button></DialogFooter>
  </DialogContent></Dialog>;
}
