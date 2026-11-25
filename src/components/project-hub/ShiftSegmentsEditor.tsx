import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Time24Input } from '@/components/ui/time24-input';
import { X } from 'lucide-react';
import { blankSegment, type ShiftMode, type ShiftSegment } from '@/lib/shiftSegments';

export function ShiftSegmentsEditor({ idPrefix, day, mode, onModeChange, segments, onChange, onUseShift, disabled, useShiftDisabled }: {
  idPrefix: string; day: string; mode: ShiftMode; onModeChange: (m: ShiftMode) => void; segments: ShiftSegment[];
  onChange: (s: ShiftSegment[]) => void; onUseShift: () => void; disabled?: boolean; useShiftDisabled?: boolean;
}) {
  const set = (i: number, patch: Partial<ShiftSegment>) => onChange(segments.map((s, j) => j === i ? { ...s, ...patch } : s));
  return <div className="space-y-3">
    <div className="flex gap-2"><Select value={mode} disabled={disabled} onValueChange={v => onModeChange(v === 'night' ? 'night' : v === 'split' ? 'split' : 'day')}><SelectTrigger aria-label="Scheduled shift"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">Day shift</SelectItem><SelectItem value="night">Night shift</SelectItem><SelectItem value="split">Split shift (both)</SelectItem></SelectContent></Select><Button type="button" variant="outline" disabled={disabled || useShiftDisabled} onClick={onUseShift}>Use shift times</Button></div>
    {segments.map((s, i) => <div key={i} className="space-y-2 rounded-md border p-2">
      <div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">Shift {i + 1}</span>{i > 0 && <Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label={`Remove shift ${i + 1}`} disabled={disabled} onClick={() => onChange(segments.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>}</div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label htmlFor={`${idPrefix}-in-${i}`}>Time in (24h)</Label><Time24Input id={`${idPrefix}-in-${i}`} step={60} className="h-11" value={s.tin} disabled={disabled} onChange={e => set(i, { tin: e.target.value })} /></div>
        <div><Label htmlFor={`${idPrefix}-out-${i}`}>Time out (24h)</Label><Time24Input allowEndOfDay id={`${idPrefix}-out-${i}`} step={60} className="h-11" value={s.tout} disabled={disabled} onChange={e => set(i, { tout: e.target.value })} /></div>
      </div>
      <div><Label htmlFor={`${idPrefix}-outday-${i}`}>Time out date</Label><Input id={`${idPrefix}-outday-${i}`} type="date" min={day} value={s.outDay} disabled={disabled} onChange={e => set(i, { outDay: e.target.value })} /></div>
    </div>)}
    <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange([...segments, blankSegment(day)])}>＋ Add another shift</Button>
  </div>;
}
