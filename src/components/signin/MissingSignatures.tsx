import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUserRole } from '@/hooks/useUserRole';
import { summarizeSignatures } from '@/lib/signatureRequests';
import { localTime } from '@/lib/signinSheets';
import { Loader2, Send } from 'lucide-react';
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
  const { data, isLoading, error:loadError } = useQuery({
    queryKey: ['timesheet-sig-requests', locationId, day, ids.join(',')], enabled: ids.length > 0 && (isAdmin || isManager),
    queryFn: async () => {
      const [req, ppl] = await Promise.all([
        supabase.from('timesheet_signature_requests').select('personnel_id,status,sms_status,requested_at,expires_at').eq('location_id', locationId).eq('sheet_date', day).in('personnel_id', ids).order('requested_at', { ascending: false }),
        supabase.from('personnel').select('id,phone').in('id', ids),
      ]);
      if (req.error) throw req.error; if (ppl.error) throw ppl.error;
      return { requests: req.data, phones: new Map(ppl.data.map(p => [p.id, p.phone])) };
    },
  });
  if (!summary.total) return null;
  const pending = (id: string) => data?.requests.find(r => r.personnel_id === id && r.status === 'pending' && Date.parse(r.expires_at) > Date.now());
  const textable = (id: string) => { const d = String(data?.phones.get(id) ?? '').replace(/\D/g, ''); return d.length === 10 || (d.length === 11 && d.startsWith('1')); };
  const toSend = summary.missing.filter(m => textable(m.personnelId) && !pending(m.personnelId));
  const request = async (personnelIds:string[]) => {
    if(!personnelIds.length||busy)return;
    setBusy(true);
    const { data: out, error } = await supabase.functions.invoke('timesheet-signature', { body: { action: 'request', location_id: locationId, sheet_date: day, personnel_ids: personnelIds } });
    setBusy(false);
    if (error || out?.error) return toast.error('Could not send signature requests');
    const res: { status: string }[] = out.results ?? [];
    const sent = res.filter(r => r.status === 'requested').length, failed = res.filter(r => r.status === 'failed').length;
    toast[failed ? 'warning' : 'success'](`${sent} signature request${sent === 1 ? '' : 's'} sent${failed ? ` · ${failed} failed` : ''}`);
    qc.invalidateQueries({ queryKey: ['timesheet-sig-requests', locationId, day] });
  };
  return <>
    <div className={compact?'inline-flex flex-wrap items-center gap-2':'flex flex-wrap items-center justify-between gap-2 py-2 text-sm'} aria-label="Signature summary">
      {!compact&&<p className="font-medium">{summary.signed} of {summary.total} signed</p>}
      {summary.missing.length?<Button size="sm" variant="outline" className="text-destructive border-destructive/40" onClick={()=>setOpen(true)}>{summary.missing.length} missing signature{summary.missing.length===1?'':'s'}</Button>:<Badge variant="secondary">All signed</Badge>}
    </div>
    <Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Missing signatures · {day}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{summary.signed} of {summary.total} signed · {summary.missing.length} missing</p>
      {isLoading&&<Loader2 className="h-4 w-4 animate-spin"/>}{loadError&&<p role="alert" className="text-sm text-destructive">Phone and request details could not be loaded.</p>}
      <ul className="divide-y">{summary.missing.map(m=>{const p=pending(m.personnelId);return <li key={m.personnelId} className="flex flex-wrap items-center justify-between gap-2 py-3"><div className="min-w-0"><p className="font-medium break-words">{m.name}</p><p className="text-xs text-muted-foreground">{p?`Requested ${new Intl.DateTimeFormat('en-US',{timeZone:zone,month:'2-digit',day:'2-digit'}).format(new Date(p.requested_at))} ${localTime(p.requested_at,zone)} · ${p.sms_status}`:!data?'Checking phone…':textable(m.personnelId)?'Phone available':'No valid phone — cannot text'}</p></div>{(isAdmin||isManager)&&<Button size="sm" variant="outline" aria-label={`Request signature for ${m.name}`} disabled={busy||!data||!textable(m.personnelId)||!!p} onClick={()=>void request([m.personnelId])}><Send className="h-3.5 w-3.5 mr-1"/>{p?'Requested':'Request signature'}</Button>}</li>;})}</ul>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Close</Button>{(isAdmin||isManager)&&<Button disabled={busy||!toSend.length||!!loadError} onClick={()=>void request(toSend.map(m=>m.personnelId))}>{busy?<Loader2 className="h-4 w-4 animate-spin mr-1"/>:<Send className="h-4 w-4 mr-1"/>}Request all ({toSend.length})</Button>}</DialogFooter>
    </DialogContent></Dialog>
  </>;
}
