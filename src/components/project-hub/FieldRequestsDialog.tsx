import { useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ROLE_TAGS } from '@/lib/roleTags';
import {
  KIND_LABEL, LocationRequest, RequestKind, useActOnLocationRequest, useCreateLocationRequest, useLocationRequests,
} from '@/hooks/useLocationRequests';

export const statusTone: Record<string, string> = {
  open: 'text-warning border-warning/40', accepted: 'text-primary border-primary/40', denied: 'text-muted-foreground', done: 'text-success border-success/40',
};

export function RequestActions({ r, compact }: { r: LocationRequest; compact?: boolean }) {
  const act = useActOnLocationRequest();
  const btn = (status: 'accepted' | 'denied' | 'done', label: string) => (
    <Button size="sm" variant={status === 'denied' ? 'ghost' : 'outline'} className={cn('h-7 px-2 text-xs', compact && 'h-6')} disabled={act.isPending}
      onClick={(e) => { e.stopPropagation(); act.mutate({ id: r.id, status }); }}>{label}</Button>
  );
  if (r.status === 'open') return <span className="inline-flex gap-1">{btn('accepted', 'Accept')}{btn('denied', 'Deny')}</span>;
  if (r.status === 'accepted') return btn('done', 'Done');
  return null;
}

export function FieldRequestsDialog({ open, onOpenChange, locationId, locationName, canAct }: {
  open: boolean; onOpenChange: (v: boolean) => void; locationId: string; locationName: string; canAct: boolean;
}) {
  const { data: requests = [] } = useLocationRequests(open ? [locationId] : []);
  const create = useCreateLocationRequest();
  const [kind, setKind] = useState<RequestKind>('personnel');
  const [qty, setQty] = useState('1');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const n = Number(qty);
  const valid = Number.isInteger(n) && n > 0 && n <= 999 && (kind === 'other' || kind === 'cancellation' || label.trim().length > 0);
  const submit = () => {
    if (!valid) return;
    create.mutate({ location_id: locationId, kind, qty: n, label: label.trim().slice(0, 120) || null, note: note.trim().slice(0, 1000) || null },
      { onSuccess: () => { setLabel(''); setNote(''); setQty('1'); } });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Field requests · {locationName}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as RequestKind)}>
              <SelectTrigger aria-label="Request type"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(KIND_LABEL) as RequestKind[]).map(k => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="req-qty">Qty</Label><Input id="req-qty" inputMode="numeric" value={qty} onChange={e => setQty(e.target.value.replace(/\D/g, ''))} /></div>
          <div className="col-span-2"><Label htmlFor="req-label">{kind === 'asset' ? 'Asset' : kind === 'personnel' ? 'Role' : 'Label (optional)'}</Label>
            <Input id="req-label" list={kind === 'personnel' ? 'req-roles' : undefined} value={label} maxLength={120} onChange={e => setLabel(e.target.value)} placeholder={kind === 'asset' ? 'e.g. Pickup truck' : kind === 'personnel' ? 'e.g. Operator' : ''} />
            <datalist id="req-roles">{ROLE_TAGS.map(r => <option key={r} value={r} />)}</datalist>
          </div>
          <div className="col-span-2"><Label htmlFor="req-note">Note</Label><Textarea id="req-note" rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></div>
          <div className="col-span-2 flex justify-end"><Button onClick={submit} disabled={!valid || create.isPending}>Raise request</Button></div>
        </div>
        <div className="border-t pt-3 space-y-2">
          <h4 className="text-sm font-semibold">History</h4>
          {requests.length === 0 ? <p className="text-sm text-muted-foreground">No requests yet.</p> : requests.map(r => (
            <div key={r.id} className="flex items-start justify-between gap-2 text-sm border rounded-md p-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">{KIND_LABEL[r.kind]}</Badge>
                  <span className="font-medium">{r.qty} × {r.label || KIND_LABEL[r.kind]}</span>
                  <Badge variant="outline" className={cn('capitalize', statusTone[r.status])}>{r.status}</Badge>
                </div>
                {r.note && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{r.note}</p>}
                <p className="text-[11px] text-muted-foreground mt-1">Raised {format(new Date(r.created_at), 'M/d HH:mm')}{r.acted_at && ` · ${r.status} ${format(new Date(r.acted_at), 'M/d HH:mm')}`}</p>
              </div>
              {canAct && <RequestActions r={r} />}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
