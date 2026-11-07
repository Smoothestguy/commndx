import { Time24Input } from '@/components/ui/time24-input';
import { useEffect, useState } from "react";
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
import { useAttendanceRoster } from '@/hooks/useAttendanceRoster';
import { locationRosterPeople, manualTimeRange, scheduledShift } from "@/lib/manualTime";
import { useProject } from '@/integrations/supabase/hooks/useProjects';
import { localDay } from "@/lib/signinSheets";

const nm = (r: { first_name: string | null; last_name: string | null }) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "Unknown";

/** Manager-only manual time entry → location_visits + visit_personnel, then attendance recompute. */
export function LogTimeDialog({ open, onOpenChange, projectId, personnelId, personName, locationId, defaultDate }: {
  open: boolean; onOpenChange: (o: boolean) => void; projectId: string; personnelId?: string | null; personName?: string;
  locationId?: string; defaultDate?: string;
}) {
  const { data: locations = [] } = useProjectLocations(open ? projectId : undefined);
  const { list: people } = useCurrentStatuses({ projectId });
  const save = useLogManualTime(projectId);
  const { data: project } = useProject(projectId);
  const [pid, setPid] = useState("");
  const [loc, setLoc] = useState("");
  const [day, setDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tin, setTin] = useState("");
  const [tout, setTout] = useState("");
  const [outDay, setOutDay] = useState(day);
  const [shift, setShift] = useState<'day'|'night'>('day');
  const [note, setNote] = useState("");
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) { const date = defaultDate ?? localDay(new Date().toISOString(), locations.find(l => l.id === locationId)?.timezone || 'America/Chicago'); setPid(personnelId ?? ""); setLoc(locationId ?? ""); setDay(date); setOutDay(date); setTin(""); setTout(""); setNote(""); }
  }

  const zone = locations.find(l => l.id === loc)?.timezone || 'America/Chicago';
  const { data: roster = [], isLoading: rosterLoading } = useAttendanceRoster(projectId,locationId,day,zone,open);
  const range = manualTimeRange(day, tin, tout, zone, outDay);
  const rosterPeople = roster.map(p => ({ personnel_id: p.personnel_id, first_name: p.personnel?.first_name ?? null, last_name: p.personnel?.last_name ?? null }));
  const scopedPeople = locationRosterPeople(locationId ? rosterPeople : people, locationId, roster);
  const valid = !!pid && !!loc && !!day && !!range && (!locationId || roster.some(p => p.personnel_id === pid));
  const sortedPeople = [...scopedPeople].sort((a, b) => nm(a).localeCompare(nm(b)));
  useEffect(() => { if (open && !defaultDate && !tin && !tout && locations.length) { const date=localDay(new Date().toISOString(),zone);setDay(date);setOutDay(date); } },[open,zone,locations.length,defaultDate,tin,tout]);

  return (
    <Dialog open={open} onOpenChange={o => { if (!save.isPending) onOpenChange(o); }}>
      <DialogContent className="max-w-sm max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>Log time</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Person</Label>
            {personnelId ? <p className="text-sm font-medium py-2">{personName ?? "Selected person"}</p> : (
              <Select value={pid} onValueChange={setPid} disabled={!!locationId && rosterLoading}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select person" /></SelectTrigger>
                <SelectContent>{sortedPeople.map((p) => <SelectItem key={p.personnel_id} value={p.personnel_id}>{nm(p)}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div><Label>Location</Label>
            <Select value={loc} onValueChange={setLoc} disabled={!!locationId}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>{locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="manual-date">Date</Label><Input id="manual-date" type="date" className="h-11" value={day} onChange={(e) => { setDay(e.target.value); setOutDay(e.target.value); }} /></div>
          <div className="flex gap-2"><Select value={shift} onValueChange={v=>setShift(v==='night'?'night':'day')}><SelectTrigger aria-label="Scheduled shift"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="day">Day shift</SelectItem><SelectItem value="night">Night shift</SelectItem></SelectContent></Select><Button type="button" variant="outline" disabled={!loc || !day} onClick={()=>{const s=scheduledShift(day,shift,locations.find(l=>l.id===loc),project);setTin(s.timeIn);setTout(s.timeOut);setOutDay(s.outDay);}}>Use shift times</Button></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label htmlFor="manual-in">Time in</Label><Time24Input id="manual-in"  step={60} className="h-11" value={tin} onChange={(e) => setTin(e.target.value)} /></div>
            <div><Label htmlFor="manual-out">Time out</Label><Time24Input id="manual-out"  step={60} className="h-11" value={tout} onChange={(e) => setTout(e.target.value)} /></div>
          </div>
          <div><Label htmlFor="manual-out-date">Time out date</Label><Input id="manual-out-date" type="date" value={outDay} min={day} onChange={e=>setOutDay(e.target.value)}/></div>
          {range && <p className="text-xs text-muted-foreground">{range.hours.toFixed(2)} hours · {zone}</p>}
          {tin && tout && !range && <p className="text-xs text-destructive">Enter valid times with time out after time in.</p>}
          <div><Label>Note (optional)</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid || save.isPending} onClick={() => { if (!valid || !range) return; save.mutate(
            { personnel_id: pid, location_id: loc, day, in_at: range.inAt, out_at: range.outAt, note },
            { onSuccess: () => onOpenChange(false) },
          ); }}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
