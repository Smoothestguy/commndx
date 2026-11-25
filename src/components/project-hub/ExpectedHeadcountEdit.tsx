import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { ExpectedDay, saveExpectedDay } from '@/lib/locationExpected';

/** Caller retains permission gating; storage writes keep the existing server authorization. */
export function ExpectedHeadcountEdit({ locationId, day, value, onSaved, label, canSave = true }: { locationId: string; day: string; value: ExpectedDay | null; onSaved: () => void; label?: string; canSave?: boolean }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ supervisors: '', technicians: '', operators: '', source: '' });
  const [busy, setBusy] = useState(false);
  const start = (o: boolean) => { if (o) setF({ supervisors: String(value?.supervisors ?? 0), technicians: String(value?.technicians ?? 0), operators: String(value?.operators ?? 0), source: value?.source ?? 'customer sheet' }); setOpen(o); };
  const n = (s: string) => Math.max(0, Math.floor(Number(s) || 0));
  return <Popover open={open} onOpenChange={start}>
    <PopoverTrigger asChild><Button variant={label ? 'link' : 'ghost'} size={label ? 'sm' : 'icon'} className={label ? 'min-h-11 px-0 text-xs' : 'h-7 w-7'} aria-label={label || 'Edit expected headcount'}><Pencil className="h-3 w-3" />{label && <span className="ml-1">{label}</span>}</Button></PopoverTrigger>
    <PopoverContent className="w-64 space-y-2">
      <p className="text-sm font-medium">Expected headcount · {day}</p>
      {(['supervisors', 'technicians', 'operators'] as const).map(k => <div key={k} className="flex items-center gap-2"><Label className="w-24 capitalize" htmlFor={`exp-${k}`}>{k}</Label><Input id={`exp-${k}`} type="number" min={0} readOnly={!canSave} className="h-8" value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></div>)}
      <div className="flex items-center gap-2"><Label className="w-24" htmlFor="exp-src">Source</Label><Input id="exp-src" readOnly={!canSave} className="h-8" value={f.source} onChange={e => setF({ ...f, source: e.target.value })} /></div>
      {canSave ? <Button size="sm" className="w-full" disabled={busy} onClick={async () => { setBusy(true); try { await saveExpectedDay(locationId, day, { supervisors: n(f.supervisors), technicians: n(f.technicians), operators: n(f.operators), source: f.source.trim() || null }); onSaved(); setOpen(false); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); } }}>Save</Button> : <p className="text-xs text-muted-foreground">An admin must save customer-sheet requirements. Managers can edit Site requirements.</p>}
    </PopoverContent>
  </Popover>;
}
