import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/integrations/supabase/hooks/useProjects';
import type { ProjectLocation } from '@/integrations/supabase/hooks/useProjectLocations';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function MoveLocationProjectDialog({ location, onClose }: { location: ProjectLocation; onClose: () => void }) {
  const { data: projects = [] } = useProjects();
  const [target, setTarget] = useState(''), [reason, setReason] = useState(''), [busy, setBusy] = useState(false);
  const qc = useQueryClient(), navigate = useNavigate();
  return <Dialog open onOpenChange={o => { if (!o && !busy) onClose(); }}><DialogContent><DialogHeader><DialogTitle>Move to another project</DialogTitle></DialogHeader>
    <p className="text-sm font-medium">{location.name}</p>
    <Label>Destination project</Label><Select value={target} onValueChange={setTarget}><SelectTrigger aria-label="Destination project"><SelectValue placeholder="Choose a project" /></SelectTrigger><SelectContent>{projects.filter(p => p.id !== location.project_id && p.status === 'active' && !p.archived_at).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1"><li>Location, roster, visits and time entries</li><li>Task orders, sheets, signatures and documents</li><li>Assets, placement periods and lodging</li><li>Location-linked requests, links and engagement notes</li></ul>
    <p className="text-xs text-muted-foreground">Original files and historical IDs stay intact. Shared documents and locked or financially linked time must be resolved before moving. Project-wide records for people also assigned elsewhere stay with their original project.</p>
    <Label htmlFor="location-move-reason">Move reason</Label><Textarea id="location-move-reason" value={reason} onChange={e => setReason(e.target.value)} />
    <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy || !target || !reason.trim()} onClick={async () => {
      setBusy(true); try {
        const { error } = await supabase.rpc('move_location_project', { p_location_id: location.id, p_target_project_id: target, p_expected_project_id: location.project_id, p_reason: reason.trim() });
        if (error) throw error;
        await qc.invalidateQueries(); toast.success('Location moved; history retained'); onClose(); navigate(`/projects/${target}/locations/${location.id}`);
      } catch (e) { toast.error(e instanceof Error ? e.message : 'Location move failed'); } finally { setBusy(false); }
    }}>Confirm move</Button></DialogFooter></DialogContent></Dialog>;
}