import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUserRole } from '@/hooks/useUserRole';
import { summarizeSignatures } from '@/lib/signatureRequests';
import { localTime } from '@/lib/signinSheets';
import { Loader2, RotateCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter} from '@/components/ui/dialog';

type Row = { personnelId: string; name: string; signature: string | null };

/** Signed/missing summary for one location-day with a manager "Request signatures" text flow. */
export function MissingSignatures({ locationId, day, zone, rows, compact = false }: { locationId: string; day: string; zone: string; rows: Row[]; compact?: boolean }) {
  const { isAdmin, isManager } = useUserRole();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [open,setOpen]=useState(false);
  const summary = useMemo(() => summarizeSignatures(rows), [rows]);
  const ids = summary.missing.map(m => m.personnelId);
  const [cool, setCool] = useState<Record<string, number>>({});
  const [, tick] = useState(0);
  useEffect(() => { if (!Object.keys(cool).length) return; const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t); }, [cool]);
  type Person = { personnel_id: string; dates: string[]; request: null | { last_sent_at: string; send_count: number; sms_status: string; dates: string[] } };
  const { data, isLoading, error:loadError } = useQuery({
    queryKey: ['timesheet-sig-requests', locationId, day, ids.join(',')], enabled: ids.length > 0 && (isAdmin || isManager),
    queryFn: async () => {
      const [miss, ppl] = await Promise.all([
        supabase.functions.invoke('timesheet-signature', { body: { action: 'missing', location_id: locationId, personnel_ids: ids } }),
        supabase.from('personnel').select('id,phone').in('id', ids),
      ]);
      if (miss.error || miss.data?.error) throw miss.error || new Error(miss.data.error); if (ppl.error) throw ppl.error;
      return { people: new Map<string, Person>((miss.data.people as Person[]).map(p => [p.personnel_id, p])), phones: new Map(ppl.data.map(p => [p.id, p.phone])) };
    },
  });
  if (!summary.total) return null;
  const info = (id: string) => data?.people.get(id);
  const pending = (id: string) => info(id)?.request ?? null;
  const textable = (id: string) => { const d = String(data?.phones.get(id) ?? '').replace(/\D/g, ''); return d.length === 10 || (d.length === 11 && d.startsWith('1')); };
  const toSend = summary.missing.filter(m => textable(m.personnelId) && !pending(m.personnelId));
  const md = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}`;
  const waitS = (id: string) => { const p = pending(id); const last = Math.max(cool[id] ?? 0, p ? Date.parse(p.last_sent_at) : 0); return Math.max(0, Math.ceil((last + 60000 - Date.now()) / 1000)); };
  const call = async (body: Record<string, unknown>) => {
    if(busy)return;
    setBusy(true);
    const { data: out, error } = await supabase.functions.invoke('timesheet-signature', { body: { location_id: locationId, ...body } });
    setBusy(false);
    if (error || out?.error) return toast.error('Could not send signature requests');
    const res: { personnel_id: string; status: string; retry_in_s?: number }[] = out.results ?? [];
    const now = Date.now(); setCool(c => ({ ...c, ...Object.fromEntries(res.filter(r => r.status === 'requested' || r.status === 'resent').map(r => [r.personnel_id, now])) }));
    const sent = res.filter(r => r.status === 'requested' || r.status === 'resent').length, failed = res.filter(r => r.status === 'failed').length, limited = res.find(r => r.status === 'rate_limited');
    if (limited) toast.warning(`Wait ${limited.retry_in_s}s before resending`);
    else toast[failed ? 'warning' : 'success'](`${sent} text${sent === 1 ? '' : 's'} sent${failed ? ` · ${failed} failed` : ''}`);
    qc.invalidateQueries({ queryKey: ['timesheet-sig-requests', locationId] });
  };
  const request = (personnelIds: string[]) => personnelIds.length ? call({ action: 'request', sheet_date: day, personnel_ids: personnelIds }) : undefined;
  return <>
    <div className={compact?'inline-flex flex-wrap items-center gap-2':'flex flex-wrap items-center justify-between gap-2 py-2 text-sm'} aria-label="Signature summary">
      {!compact&&<p className="font-medium">{summary.signed} of {summary.total} signed</p>}
      {summary.missing.length?<Button size="sm" variant="outline" className="text-destructive border-destructive/40" onClick={()=>setOpen(true)}>{summary.missing.length} missing signature{summary.missing.length===1?'':'s'}</Button>:<Badge variant="secondary">All signed</Badge>}
    </div>
    <Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Missing signatures · {day}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{summary.signed} of {summary.total} signed · {summary.missing.length} missing</p>
      {isLoading&&<Loader2 className="h-4 w-4 animate-spin"/>}{loadError&&<p role="alert" className="text-sm text-destructive">Phone and request details could not be loaded.</p>}
      <ul className="divide-y">{summary.missing.map(m=>{const p=pending(m.personnelId),dates=info(m.personnelId)?.dates??[],w=waitS(m.personnelId);return <li key={m.personnelId} className="flex flex-wrap items-center justify-between gap-2 py-3"><div className="min-w-0"><p className="font-medium break-words">{m.name}{dates.length>1&&<span className="text-muted-foreground font-normal"> — {dates.length} dates</span>}</p>{dates.length>1&&<p className="text-xs text-muted-foreground tabular-nums">{dates.map(md).join(', ')}</p>}<p className="text-xs text-muted-foreground">{p?`Requested ${md(new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(new Date(p.last_sent_at)))} ${localTime(p.last_sent_at,zone)} · sent ${p.send_count}× · ${p.sms_status}`:!data?'Checking phone…':textable(m.personnelId)?'Phone available':'No valid phone — cannot text'}</p></div>{(isAdmin||isManager)&&(p?<Button size="sm" variant="outline" aria-label={`Resend signature request to ${m.name}`} disabled={busy||!textable(m.personnelId)||w>0} onClick={()=>void call({action:'resend',personnel_id:m.personnelId})}><RotateCw className="h-3.5 w-3.5 mr-1"/>{w>0?`Resend in ${w}s`:'Resend'}</Button>:<Button size="sm" variant="outline" aria-label={`Request signature for ${m.name}`} disabled={busy||!data||!textable(m.personnelId)} onClick={()=>void request([m.personnelId])}><Send className="h-3.5 w-3.5 mr-1"/>{dates.length>1?`Request ${dates.length} dates`:'Request signature'}</Button>)}</li>;})}</ul>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Close</Button>{(isAdmin||isManager)&&<Button disabled={busy||!toSend.length||!!loadError} onClick={()=>void request(toSend.map(m=>m.personnelId))}>{busy?<Loader2 className="h-4 w-4 animate-spin mr-1"/>:<Send className="h-4 w-4 mr-1"/>}Request all ({toSend.length})</Button>}</DialogFooter>
    </DialogContent></Dialog>
  </>;
}
