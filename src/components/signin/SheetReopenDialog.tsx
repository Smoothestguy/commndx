import { useEffect, useState } from 'react';
import { subscribeSheetReopen, type LockRequest } from '@/lib/sheetLocks';
import { validReopenReason } from '@/lib/sheetApprovalRules';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
export function SheetReopenDialog() {
  const [request, setRequest] = useState<LockRequest | null>(null), [reason, setReason] = useState('');
  useEffect(() => subscribeSheetReopen(r => { setRequest(r); setReason(''); }), []);
  return <Dialog open={!!request} onOpenChange={open => { if (!open) request?.resolve(null); }}><DialogContent><DialogHeader><DialogTitle>Sheet is locked — re-opening creates a new version</DialogTitle><DialogDescription>{request?.title}</DialogDescription></DialogHeader><Textarea aria-label="Reason for re-opening" value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /><DialogFooter><Button variant="outline" onClick={() => request?.resolve(null)}>Cancel</Button><Button disabled={!validReopenReason(reason)} onClick={() => request?.resolve(reason.trim())}>Re-open and continue</Button></DialogFooter></DialogContent></Dialog>;
}
