import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useProjectLocations } from "@/integrations/supabase/hooks/useProjectLocations";
import { useCurrentStatuses } from "@/integrations/supabase/hooks/usePersonnelStatus";
import { useLogManualTime } from "@/integrations/supabase/hooks/useFieldMode";

const nm = (r: { first_name: string | null; last_name: string | null }) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "Unknown";

/** Manager-only manual time entry → location_visits + visit_personnel, then attendance recompute. */
export function LogTimeDialog({ open, onOpenChange, projectId, personnelId, personName }: {
  open: boolean; onOpenChange: (o: boolean) => void; projectId: string; personnelId?: string | null; personName?: string;
}) {
  const { data: locations = [] } = useProjectLocations(open ? projectId : undefined);
  const { list: people } = useCurrentStatuses({ projectId });
  const save = useLogManualTime(projectId);
  const [pid, setPid] = useState("");
  const [loc, setLoc] = useState("");
  const [day, setDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tin, setTin] = useState("");
  const [tout, setTout] = useState("");
  const [note, setNote] = useState("");
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) { setPid(personnelId ?? ""); setLoc(""); setDay(format(new Date(), "yyyy-MM-dd")); setTin(""); setTout(""); setNote(""); }
  }

  const inAt = tin ? new Date(`${day}T${tin}`) : null;
  const outAt = tout ? new Date(`${day}T${tout}`) : null;
  const orderOk = !!inAt && !!outAt && outAt > inAt;
  const valid = !!pid && !!loc && !!day && orderOk;
  const sortedPeople = [...people].sort((a, b) => nm(a).localeCompare(nm(b)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>Log time</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Person</Label>
            {personnelId ? <p className="text-sm font-medium py-2">{personName ?? "Selected person"}</p> : (
              <Select value={pid} onValueChange={setPid}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select person" /></SelectTrigger>
                <SelectContent>{sortedPeople.map((p) => <SelectItem key={p.personnel_id} value={p.personnel_id}>{nm(p)}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div><Label>Location</Label>
            <Select value={loc} onValueChange={setLoc}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>{locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Date</Label><Input type="date" className="h-11" value={day} onChange={(e) => setDay(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Time in</Label><Input type="time" className="h-11" value={tin} onChange={(e) => setTin(e.target.value)} /></div>
            <div><Label>Time out</Label><Input type="time" className="h-11" value={tout} onChange={(e) => setTout(e.target.value)} /></div>
          </div>
          {tin && tout && !orderOk && <p className="text-xs text-destructive">Time out must be after time in.</p>}
          <div><Label>Note (optional)</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate(
            { personnel_id: pid, location_id: loc, day, in_at: inAt!.toISOString(), out_at: outAt!.toISOString(), note },
            { onSuccess: () => onOpenChange(false) },
          )}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
