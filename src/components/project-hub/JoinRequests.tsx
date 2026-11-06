import { useState } from 'react';
import { format } from 'date-fns';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useJoinRequests, useInvalidateJoinApproval } from '@/hooks/useJoinRequests';
import { useUserRole } from '@/hooks/useUserRole';
import { canReviewJoinRequests, joinApprovalSchema, pendingJoinRequests } from '@/lib/projectJoin';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Loader2, RefreshCw, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

export function JoinRequests({ projectId, locationId, strip = false }: { projectId: string; locationId?: string; strip?: boolean }) {
  const query = useJoinRequests(projectId), invalidate = useInvalidateJoinApproval();
  const { role } = useUserRole();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, { name: string; reason: string; retry: boolean }>>({});
  const rows = pendingJoinRequests(query.data || [], locationId);
  const notify = async (id: string, name: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-site-assignment-sms', { body: { action: 'join_approval', request_id: id } });
      if (error) {
        const detail = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
        throw new Error(detail?.error || 'Unable to confirm notification delivery');
      }
      if (data?.sms_status === 'sent') { setFailed(s => { const next = { ...s }; delete next[id]; return next; }); toast.success(`${name} approved · check-in text sent`); }
      else { setFailed(s => ({ ...s, [id]: { name, reason: data?.reason || 'Notification not confirmed', retry: data?.sms_status === 'failed' } })); toast.warning(`${name} approved; text not confirmed`); }
    } catch (error) { setFailed(s => ({ ...s, [id]: { name, reason: error instanceof Error ? error.message : 'Text not confirmed', retry: true } })); toast.warning(`${name} approved; text needs attention`); }
  };
  if (!canReviewJoinRequests(role)) return null;
  if (!rows.length && !query.error && !Object.keys(failed).length) return null;
  return <>
    <div className={strip ? 'border border-warning/40 bg-warning/10 rounded-md px-2 py-1 flex flex-wrap gap-2 items-center' : 'inline-flex max-w-full'}>
      <Button size="sm" variant="outline" className="h-8 text-xs text-warning max-w-full" onClick={() => setOpen(true)}><UserPlus className="h-3.5 w-3.5 mr-1 shrink-0" />{query.error ? 'Join requests unavailable' : `${rows.length} join request${rows.length === 1 ? '' : 's'}`}</Button>
      {strip && Object.keys(failed).length > 0 && <span className="text-xs text-warning">Approved texts need attention</span>}
    </div>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>Join requests</DialogTitle></DialogHeader>
      {query.error && <div role="alert"><p className="text-sm text-destructive">Unable to load requests.</p><Button variant="outline" onClick={() => query.refetch()}>Retry</Button></div>}
      {rows.map(request => { const name = `${request.first_name} ${request.last_name}`; return <div key={request.id} className="border-b py-3 space-y-2"><div className="font-medium break-words">{name}</div><div className="text-sm text-muted-foreground"><a href={`tel:${request.phone}`}>{request.phone}</a> · {format(new Date(request.requested_at), 'MMM d, h:mm a')}</div>{request.matched_name && <p className="text-xs text-muted-foreground">matches existing: {request.matched_name}</p>}<div className="flex gap-2">
        <Button size="sm" disabled={!!busy} onClick={async () => { setBusy(request.id); try { const { data, error } = await supabase.rpc('approve_join_request', { p_request: request.id }); if (error) throw error; const result = joinApprovalSchema.parse(data); if (!result.ok) throw new Error(result.reason === 'not_pending' ? 'Already handled. Refresh the list.' : 'Unable to approve request'); await notify(request.id, name); } catch (error) { toast.error(error instanceof Error ? error.message : 'Approval failed'); } finally { await invalidate(); setBusy(null); } }}>{busy === request.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}Approve</Button>
        <Button size="sm" variant="outline" disabled={!!busy} onClick={async () => { setBusy(request.id); try { const { data, error } = await supabase.rpc('deny_join_request', { p_request: request.id }); if (error) throw error; if (!joinApprovalSchema.parse(data).ok) throw new Error('Request already handled or access denied'); toast.success('Request denied'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to deny request'); } finally { await invalidate(); setBusy(null); } }}><X className="h-4 w-4 mr-1" />Deny</Button>
      </div></div>; })}
      {!rows.length && !query.error && <p className="text-sm text-muted-foreground">No pending join requests.</p>}
      {Object.entries(failed).map(([id, issue]) => <div key={id} role="alert" className="border-t pt-3 space-y-2"><p className="text-sm text-warning">{issue.name} is approved. {issue.reason}</p>{issue.retry && <Button size="sm" variant="outline" disabled={!!busy} onClick={async () => { setBusy(id); await notify(id, issue.name); setBusy(null); }}><RefreshCw className="h-4 w-4 mr-1" />Retry text only</Button>}</div>)}
    </DialogContent></Dialog>
  </>;
}