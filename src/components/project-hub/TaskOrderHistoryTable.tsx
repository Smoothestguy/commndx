import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, FileSpreadsheet, Printer, MoreHorizontal } from 'lucide-react';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatLocalDate } from '@/lib/dateUtils';
import { formatChanges, formatTotals, kindLabel, runningTotals, type HistoryOrder, type HistoryRow } from '@/lib/taskOrderHistory';
import { exportTaskOrderHistoryXlsx, printTaskOrderHistory, type HistoryHeader } from '@/lib/taskOrderHistoryExport';
import { detailEntries } from '@/lib/taskOrderExtras';

const tones: Record<string, string> = { initial: 'text-success border-success/40', increase: 'text-info border-info/40', decrease: 'text-warning border-warning/40', demobilization: 'text-destructive border-destructive/40' };
const isDown = (k: string) => k === 'decrease' || k === 'demobilization';

/** Compact TO ledger: one row per order with resulting totals, expandable details, selection and print/XLSX. */
export function TaskOrderHistoryTable({ orders, header, fileBase, today, renderExpanded, onDemobe }: { orders: HistoryOrder[]; header: HistoryHeader; fileBase: string; today?: string; renderExpanded?: (id: string) => ReactNode; onDemobe?:(id:string)=>void }) {
  const rows = useMemo(() => runningTotals(orders), [orders]);
  const [selected, setSelected] = useState<Set<string>>(new Set()), [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (set: Set<string>, id: string) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); return n; };
  const current = today ? [...rows].reverse().find(r => r.effective_date <= today) : undefined;
  const print = (list: HistoryRow[], suffix: string) => printTaskOrderHistory(header, list, `${fileBase}-${suffix}`);
  const picked = rows.filter(r => selected.has(r.id));
  if (!rows.length) return <p className="text-muted-foreground text-sm">No task orders yet.</p>;
  return <div className="space-y-2">
    {today && <p className="text-sm font-semibold">Current level (as of {formatLocalDate(today)}): {current ? formatTotals(current.totals) : 'none'}</p>}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={!picked.length} onClick={() => print(picked, 'selected')}><Printer className="h-4 w-4 mr-1" />Print selected{picked.length ? ` (${picked.length})` : ''}</Button>
      <Button size="sm" variant="outline" onClick={() => print(rows, 'full-history')}><Printer className="h-4 w-4 mr-1" />Print full history</Button>
      <Button size="sm" variant="outline" onClick={() => void exportTaskOrderHistoryXlsx(header, picked.length ? picked : rows, fileBase)}><FileSpreadsheet className="h-4 w-4 mr-1" />XLSX{picked.length ? ' (selected)' : ''}</Button>
    </div>
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
          <th className="w-8 p-2"><Checkbox aria-label="Select all task orders" checked={picked.length === rows.length} onCheckedChange={v => setSelected(v ? new Set(rows.map(r => r.id)) : new Set())} /></th>
          <th className="p-2 text-left">TO #</th><th className="p-2 text-left">Kind</th><th className="p-2 text-left">Effective</th><th className="p-2 text-left">Changes</th><th className="p-2 text-left">Resulting totals</th><th className="p-2 text-left">Entered</th><th className="w-10 p-2"><span className="sr-only">Print</span></th>
        </tr></thead>
        <tbody>{rows.map(r => {
          const expanded = open.has(r.id), details = detailEntries(r.details);
          return <Fragment key={r.id}>
            <tr data-testid="to-row" className={`border-t cursor-pointer hover:bg-muted/30 ${r.counts ? '' : 'opacity-70'}`} onClick={() => setOpen(s => toggle(s, r.id))}>
              <td className="p-2" onClick={e => e.stopPropagation()}><Checkbox aria-label={`Select ${r.number}`} checked={selected.has(r.id)} onCheckedChange={() => setSelected(s => toggle(s, r.id))} /></td>
              <td className="p-2 font-medium whitespace-nowrap"><ChevronRight className={`inline h-3 w-3 mr-1 transition-transform ${expanded ? 'rotate-90' : ''}`} />{r.number}</td>
              <td className="p-2"><Badge variant="outline" className={tones[r.kind]}>{kindLabel(r.kind)}</Badge>{!r.counts && <Badge variant="outline" className="ml-1 text-warning">{r.status}</Badge>}</td>
              <td className="p-2 whitespace-nowrap tabular-nums">{formatLocalDate(r.effective_date)}{r.effective_time ? ` ${r.effective_time.slice(0, 5).replace(':', '')}` : ''}</td>
              <td className="p-2 tabular-nums">{formatChanges(r.lines)}</td>
              <td data-testid="to-totals" className="p-2 font-semibold tabular-nums">{r.fullDemob ? <span className="text-destructive">Full demobilization — location closes</span> : <>{isDown(r.kind) && '→ '}{formatTotals(r.totals)}{isDown(r.kind) && <span className="font-normal text-muted-foreground"> remain</span>}</>}</td>
              <td className="p-2 text-xs text-muted-foreground">{r.enteredBy}</td>
              <td className="p-2" onClick={e => e.stopPropagation()}><div className="flex"><Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Print ${r.number}`} onClick={() => print([r], r.number)}><Printer className="h-4 w-4" /></Button>{onDemobe&&r.counts&&isDown(r.kind)&&<DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Actions ${r.number}`}><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={()=>onDemobe(r.id)}>Demobe time</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</div></td>
            </tr>
            {expanded && <tr className="bg-muted/20"><td /><td colSpan={7} className="p-3 space-y-1 text-sm">
              {r.scope && <p><span className="text-muted-foreground">Scope:</span> {r.scope}</p>}
              {r.travel_time != null && <p><span className="text-muted-foreground">Travel time:</span> {r.travel_time ? 'Yes' : 'No'}</p>}
              {details.map(([k, v]) => <p key={k}><span className="text-muted-foreground">{k}:</span> {v}</p>)}
              {r.notes ? <p className="whitespace-pre-wrap">{r.notes}</p> : !details.length && r.travel_time == null && <p className="text-muted-foreground">No notes or details.</p>}
              {renderExpanded?.(r.id)}
            </td></tr>}
          </Fragment>;
        })}</tbody>
      </table>
    </div>
  </div>;
}
