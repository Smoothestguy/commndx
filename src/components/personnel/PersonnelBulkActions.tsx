import { useState } from 'react';
import { MessageSquare, Star, StarOff, Tag, Download, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SendSiteTextDialog } from '@/components/project-hub/SendSiteTextDialog';
import { TagInput } from './PersonnelTags';
import { useAddTags, useBulkPersonnelUpdate } from '@/hooks/usePersonnelTags';
import { toast } from 'sonner';

export interface BulkPerson { id: string; first_name: string; last_name: string; phone?: string | null; email?: string | null; status?: string | null; on_bench?: boolean | null }

function csvCell(v: unknown) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

/** Shared bulk actions for selected personnel: text punch links, bench, tag, status, export (no rates). */
export function PersonnelBulkActions({ people, worksFor, tagsByPerson, onDone }: {
  people: BulkPerson[]; worksFor: (p: BulkPerson) => string; tagsByPerson?: Record<string, string[]>; onDone?: () => void;
}) {
  const [textOpen, setTextOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const upd = useBulkPersonnelUpdate();
  const addTags = useAddTags();
  const ids = people.map(p => p.id);
  const bench = (on: boolean) => upd.mutate({ ids, patch: on ? { on_bench: true } : { on_bench: false, bench_rank: null } }, {
    onSuccess: () => { toast.success(`${ids.length} ${on ? 'added to' : 'removed from'} bench`); onDone?.(); },
  });
  const exportCsv = () => {
    const head = ['Name', 'Phone', 'Email', 'Status', 'Works for', 'Bench', 'Tags'];
    const rows = people.map(p => [`${p.first_name} ${p.last_name}`, p.phone, p.email, p.status, worksFor(p), p.on_bench ? 'Yes' : '', (tagsByPerson?.[p.id] ?? []).join('; ')]);
    const blob = new Blob([[head, ...rows].map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `personnel-selected-${ids.length}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  if (!ids.length) return null;
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setTextOpen(true)}><MessageSquare className="h-4 w-4 mr-1" />Text punch link</Button>
      <Button size="sm" variant="outline" disabled={upd.isPending} onClick={() => bench(true)}><Star className="h-4 w-4 mr-1" />Add to bench</Button>
      <Button size="sm" variant="outline" disabled={upd.isPending} onClick={() => bench(false)}><StarOff className="h-4 w-4 mr-1" />Remove from bench</Button>
      <Popover open={tagOpen} onOpenChange={setTagOpen}>
        <PopoverTrigger asChild><Button size="sm" variant="outline"><Tag className="h-4 w-4 mr-1" />Add tag</Button></PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <TagInput autoFocus onPick={t => addTags.mutate({ personnelIds: ids, tag: t }, { onSuccess: n => { toast.success(`Tagged ${n} with “${t}”`); setTagOpen(false); } })} />
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="sm" variant="outline"><UserCog className="h-4 w-4 mr-1" />Status</Button></DropdownMenuTrigger>
        <DropdownMenuContent>
          {(['active', 'inactive', 'do_not_hire'] as const).map(st => (
            <DropdownMenuItem key={st} onClick={() => upd.mutate({ ids, patch: { status: st } }, { onSuccess: () => { toast.success('Status updated'); onDone?.(); } })}>
              {st === 'do_not_hire' ? 'Do not hire' : st[0].toUpperCase() + st.slice(1)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Export</Button>
      <SendSiteTextDialog open={textOpen} onOpenChange={setTextOpen} personnelIds={ids} />
    </>
  );
}
