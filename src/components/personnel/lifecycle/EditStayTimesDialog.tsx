import { Time24Input } from '@/components/ui/time24-input';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, Undo2, X } from 'lucide-react';
import { draftStay, stayRange, type StayDraft } from '@/lib/stayEdits';
import { sourceFromNotes } from '@/integrations/supabase/hooks/useTimekeeping';
import { useEditStayTimes } from '@/hooks/useEditStayTimes';

export function EditStayTimesDialog({ projectId, ids, personName, day, onClose }: { projectId: string; ids: string[]; personName: string; day?: string; onClose: () => void }) {
  const save = useEditStayTimes(projectId);
  const [drafts, setDrafts] = useState<StayDraft[]>([]);
  const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['edit-stays', projectId, ids], gcTime: 0, refetchOnWindowFocus: false, queryFn: async () => {
    const { data, error } = await supabase.from('personnel_location_trail').select('visit_personnel_id,visit_id,in_at,out_at,location_id,location_name').in('visit_personnel_id', ids).eq('project_id', projectId);
    if (error) throw error;
    const rows = data || [];
    const [locations, notes] = await Promise.all([
      supabase.from('project_locations').select('id,timezone').in('id', rows.flatMap(r => r.location_id ? [r.location_id] : [])),
      supabase.from('location_visits').select('id,notes').in('id', rows.flatMap(r => r.visit_id ? [r.visit_id] : [])),
    ]);
    if (locations.error) throw locations.error;
    if (notes.error) throw notes.error;
    return rows.flatMap(r => r.visit_personnel_id && r.in_at ? [{ ...r, id: r.visit_personnel_id, inAt: r.in_at, outAt: r.out_at, zone: locations.data?.find(l => l.id === r.location_id)?.timezone || 'America/Chicago', source: sourceFromNotes(notes.data?.find(n => n.id === r.visit_id)?.notes) }] : []);
  } });
  useEffect(() => { if (query.data) setDrafts(query.data.map(s => draftStay(s.id, s.inAt, s.outAt, s.zone, day))); }, [query.data, day]);
  const update = (id: string, values: Partial<StayDraft>) => setDrafts(prev => prev.map(d => d.id === id ? { ...d, ...values } : d));
  // Blank (untouched/cleared) fields keep the stored value, so editing one side never blocks on the other.
  const eff = (d: StayDraft): StayDraft => { const s = query.data?.find(s => s.id === d.id); if (!s) return d; const o = draftStay(s.id, s.inAt, s.outAt, s.zone, day); return { ...d, inTime: d.inTime.trim() || o.inTime, inDate: d.inDate || o.inDate, outTime: d.outTime.trim() || (s.outAt ? o.outTime : ''), outDate: d.outDate || o.outDate }; };
  const valid = drafts.length > 0 && drafts.every(d => { const s = query.data?.find(s => s.id === d.id); return d.removed || !!stayRange(eff(d), s?.zone || 'America/Chicago'); });
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}><DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto max-md:[&_button]:min-h-11 max-md:[&_input]:min-h-11"><DialogHeader><DialogTitle>Edit times · {personName}</DialogTitle></DialogHeader>
    {query.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
    {query.error && <p role="alert" className="text-sm text-destructive">Unable to load stays.</p>}
    <div className="divide-y">{drafts.map(d => { const s = query.data?.find(s => s.id === d.id); if (!s) return null; return <div key={d.id} className="py-3 space-y-2">
      <div className="flex items-center gap-2"><span className="font-medium text-sm flex-1">{s.location_name}</span><Badge variant="outline">{s.source === 'Manual' ? 'manual' : s.source === 'Self check-in' ? 'self' : 'punch'}</Badge><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={d.removed ? 'Restore stay' : `Delete stay at ${s.location_name}`} onClick={() => update(d.id, { removed: !d.removed })}>{d.removed ? <Undo2 className="h-4 w-4" /> : <X className="h-4 w-4" />}</Button></div>
      {d.removed ? <p className="text-sm text-destructive">Stay will be deleted when saved.</p> : <>
        {!s.outAt && !d.outTime && <div className="flex items-center justify-between"><span className="text-sm text-warning">Still running</span><Button variant="outline" size="sm" onClick={() => document.getElementById(`${d.id}-out`)?.focus()}><Clock className="h-4 w-4 mr-1" />Set time out</Button></div>}
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label htmlFor={`${d.id}-in`}>Time in</Label><Time24Input  step={60} id={`${d.id}-in`} value={d.inTime} onChange={e => update(d.id, { inTime: e.target.value })} /><Input aria-label="Time in date" type="date" value={d.inDate} onChange={e => update(d.id, { inDate: e.target.value })} /></div><div className="space-y-1"><Label htmlFor={`${d.id}-out`}>Time out</Label><Time24Input  step={60} id={`${d.id}-out`} value={d.outTime} onChange={e => update(d.id, { outTime: e.target.value })} /><Input aria-label="Time out date" type="date" value={d.outDate} onChange={e => update(d.id, { outDate: e.target.value })} /></div></div>
        <p className="text-xs text-muted-foreground">{s.zone}</p>{!stayRange(eff(d), s.zone) && <p className="text-xs text-destructive">{[eff(d).inTime, eff(d).outTime].some(t => t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) ? 'Enter a valid military time from 0000 to 2359.' : 'Time out must be after time in.'}</p>}
      </>}
    </div>; })}</div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <DialogFooter><Button variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button disabled={!valid || save.isPending} onClick={async () => {
      setError('');
      const changes = drafts.flatMap(d => { const s = query.data?.find(s => s.id === d.id); if (!s) return []; const r = stayRange(eff(d), s.zone); if (d.removed) return [{ id: d.id, inAt: s.inAt, outAt: s.outAt, remove: true }]; if (!r || (Date.parse(r.inAt) === Date.parse(s.inAt) && (r.outAt ? Date.parse(r.outAt) : null) === (s.outAt ? Date.parse(s.outAt) : null))) return []; return [{ id: d.id, ...r, remove: false }]; });
      if (!changes.length) { onClose(); return; }
      try { await save.mutateAsync(changes); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save times'); }
    }}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save</Button></DialogFooter>
  </DialogContent></Dialog>;
}