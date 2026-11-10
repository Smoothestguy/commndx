import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { AssetBillingRow } from '@/integrations/supabase/hooks/useAssetAssignments';
import { localDay } from '@/lib/signinSheets';
import { locationTimeIso } from '@/lib/manualTime';
import { placementDatesValid } from '@/lib/placementDates';

export function EditAssetPlacementDates({ row, timezone = 'America/Chicago', onClose }: { row: AssetBillingRow; timezone?: string; onClose: () => void }) {
  const [start, setStart] = useState(localDay(row.start_at, timezone));
  const [end, setEnd] = useState(row.end_at || row.unassigned_at ? localDay(row.end_at || row.unassigned_at || '', timezone) : '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  return <Dialog open onOpenChange={o => { if (!o && !busy) onClose(); }}><DialogContent><DialogHeader><DialogTitle>Edit placement dates · {row.assets?.label}</DialogTitle></DialogHeader>
    <div className="space-y-3"><div><Label htmlFor="placement-start">Start date</Label><Input id="placement-start" type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
      <div><Label htmlFor="placement-end">End date</Label><Input id="placement-end" type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} /></div>
      <div><Label htmlFor="placement-reason">Correction reason</Label><Textarea id="placement-reason" value={reason} onChange={e => setReason(e.target.value)} /></div>
      {end && end < start && <p role="alert" className="text-destructive text-sm">End date must not precede start date.</p>}
      <p className="text-xs text-muted-foreground">{timezone} · Placement status and responsibility history remain unchanged.</p>
    </div><DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy || !reason.trim() || !placementDatesValid(start, end, row.status !== 'active' || !!row.end_at)} onClick={async () => {
      setBusy(true);
      try {
        const { error } = await supabase.rpc('correct_asset_placement_dates', { p_assignment_id: row.id, p_start_at: locationTimeIso(start, '08:00', timezone), p_end_at: end ? locationTimeIso(end, '17:00', timezone) : null, p_reason: reason.trim(), p_expected_updated_at: row.updated_at });
        if (error) throw error;
        await qc.invalidateQueries(); toast.success('Placement dates corrected'); onClose();
      } catch (e) { toast.error(e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Date correction failed'); } finally { setBusy(false); }
    }}>Save dates</Button></DialogFooter></DialogContent></Dialog>;
}