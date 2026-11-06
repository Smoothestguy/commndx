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

type Row = { personnelId: string; name: string; signature: string | null };

/** Signed/missing summary for one location-day with a manager "Request signatures" text flow. */
export function MissingSignatures({ locationId, day, zone, rows, compact = false }: { locationId: string; day: string; zone: string; rows: Row[]; compact?: boolean }) {
  const { isAdmin, isManager } = useUserRole();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const summary = useMemo(() => summarizeSignatures(rows), [rows]);
  const ids = summary.missing.map(m => m.personnelId);
  const { data } = useQuery({
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
  const request = async () => {
    setBusy(true);
    const { data: out, error } = await supabase.functions.invoke('timesheet-signature', { body: { action: 'request', location_id: locationId, sheet_date: day, personnel_ids: toSend.map(m => m.personnelId) } });
    setBusy(false);
    if (error || out?.error) return toast.error('Could not send signature requests');
    const res: { status: string }[] = out.results ?? [];
    const sent = res.filter(r => r.status === 'requested').length, failed = res.filter(r => r.status === 'failed').length;
    toast[failed ? 'warning' : 'success'](`${sent} signature request${sent === 1 ? '' : 's'} sent${failed ? ` · ${failed} failed` : ''}`);
    qc.invalidateQueries({ queryKey: ['timesheet-sig-requests', locationId, day] });
  };
  if (compact) return <span className="inline-flex items-center gap-2">
    <Badge variant={summary.missing.length ? 'destructive' : 'secondary'}>{summary.missing.length ? `${summary.missing.length} missing signature${summary.missing.length === 1 ? '' : 's'}` : 'All signed'}</Badge>
    {(isAdmin || isManager) && toSend.length > 0 && <Button size="sm" variant="outline" disabled={busy} onClick={request}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}Request ({toSend.length})</Button>}
  </span>;
  return <div className="rounded-md border p-3 space-y-2 text-sm" aria-label="Signature summary">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-medium">{summary.signed} of {summary.total} signed{summary.missing.length ? <span className="text-destructive"> · {summary.missing.length} missing</span> : ''}</p>
      {(isAdmin || isManager) && toSend.length > 0 && <Button size="sm" disabled={busy} onClick={request}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}Request signatures ({toSend.length})</Button>}
    </div>
    {summary.missing.length > 0 && <ul className="flex flex-wrap gap-1.5">{summary.missing.map(m => { const p = pending(m.personnelId); return <li key={m.personnelId}><Badge variant="outline" className="font-normal">{m.name}{p ? <span className="ml-1 text-muted-foreground">· requested {localTime(p.requested_at, zone)}</span> : data && !textable(m.personnelId) ? <span className="ml-1 text-muted-foreground">· no phone</span> : null}</Badge></li>; })}</ul>}
  </div>;
}
