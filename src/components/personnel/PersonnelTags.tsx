import { useState } from 'react';
import { Star, X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { normTag } from '@/lib/personnelSegment';
import { useAddTags, usePersonnelTags, useRemoveTag } from '@/hooks/usePersonnelTags';

export function BenchStar({ on, className }: { on?: boolean | null; className?: string }) {
  return on ? <Star aria-label="Bench" className={cn('inline h-3.5 w-3.5 fill-primary text-primary align-[-2px]', className)} /> : null;
}

export function TagChips({ tags, onRemove, max }: { tags?: string[]; onRemove?: (t: string) => void; max?: number }) {
  if (!tags?.length) return null;
  const shown = max ? tags.slice(0, max) : tags;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {shown.map(t => (
        <Badge key={t} variant="secondary" className="font-normal text-[10px] px-1.5 py-0 gap-0.5">
          {t}{onRemove && <button type="button" aria-label={`Remove ${t}`} onClick={() => onRemove(t)}><X className="h-3 w-3" /></button>}
        </Badge>
      ))}
      {max && tags.length > max && <span className="text-[10px] text-muted-foreground">+{tags.length - max}</span>}
    </span>
  );
}

/** Type-ahead tag input: pick an existing tag or create a new one inline. */
export function TagInput({ onPick, exclude = [], placeholder = 'Add tag…', autoFocus }: { onPick: (t: string) => void; exclude?: string[]; placeholder?: string; autoFocus?: boolean }) {
  const { data } = usePersonnelTags();
  const [v, setV] = useState('');
  const ex = new Set(exclude.map(e => e.toLowerCase()));
  const s = normTag(v).toLowerCase();
  const options = (data?.labels ?? []).filter(l => !ex.has(l.toLowerCase()) && (!s || l.toLowerCase().includes(s))).slice(0, 8);
  const exact = (data?.labels ?? []).some(l => l.toLowerCase() === s);
  const pick = (t: string) => { const n = normTag(t); if (n) { onPick(n); setV(''); } };
  return (
    <div className="space-y-1">
      <Input value={v} autoFocus={autoFocus} placeholder={placeholder} className="h-8"
        onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); pick(options[0] && !exact && !s ? options[0] : v); } }} />
      <div className="flex flex-wrap gap-1">
        {options.map(o => <button key={o} type="button" onClick={() => pick(o)} className="rounded border px-1.5 py-0.5 text-xs hover:bg-muted">{o}</button>)}
        {s && !exact && <button type="button" onClick={() => pick(v)} className="rounded border border-dashed px-1.5 py-0.5 text-xs hover:bg-muted">Create “{normTag(v)}”</button>}
      </div>
    </div>
  );
}

/** Multi-tag filter: chips + type-ahead; people must carry all chosen tags. */
export function TagFilter({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-9">Tags{value.length ? ` (${value.length})` : ''}</Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <TagInput autoFocus exclude={value} placeholder="Filter by tag…" onPick={t => onChange([...value, t])} />
        </PopoverContent>
      </Popover>
      <TagChips tags={value} onRemove={t => onChange(value.filter(x => x !== t))} />
    </div>
  );
}

/** Profile tag editor (manager). */
export function PersonnelTagEditor({ personnelId, canEdit }: { personnelId: string; canEdit: boolean }) {
  const { data } = usePersonnelTags();
  const add = useAddTags();
  const remove = useRemoveTag();
  const tags = data?.byPerson[personnelId] ?? [];
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {tags.length ? <TagChips tags={tags} onRemove={canEdit ? t => remove.mutate({ personnelId, tag: t }) : undefined} /> : <span className="text-sm text-muted-foreground">No tags yet.</span>}
        {canEdit && !adding && <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5 mr-1" />Tag</Button>}
      </div>
      {canEdit && adding && <div className="max-w-sm"><TagInput autoFocus exclude={tags} onPick={t => add.mutate({ personnelIds: [personnelId], tag: t })} />
        <Button type="button" size="sm" variant="ghost" className="h-7 mt-1" onClick={() => setAdding(false)}>Done</Button></div>}
    </div>
  );
}
