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
import { useProjectDayPeople } from '@/hooks/useProjectDayPeople';
import { Checkbox } from '@/components/ui/checkbox';
import { AddToProject } from '@/components/project-hub/ProjectPersonnelRoster';
import { useProjectPersonnelRoster } from '@/integrations/supabase/hooks/useProjectPersonnelRoster';

const nm = (r: { first_name: string | null; last_name: string | null }) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "Unknown";

/** Manager-only manual time entry → location_visits + visit_personnel, then attendance recompute. */
export function LogTimeDialog({ open, onOpenChange, projectId, personnelId, personName, locationId, defaultDate, addToDay = false }: {
  open: boolean; onOpenChange: (o: boolean) => void; projectId: string; personnelId?: string | null; personName?: string;
  locationId?: string; defaultDate?: string; addToDay?: boolean;
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
  const [saveError,setSaveError]=useState('');
  const [confirmOtherOpen,setConfirmOtherOpen]=useState(false);
  const [search, setSearch] = useState('');
  const [assign, setAssign] = useState(false);
  const [role, setRole] = useState('Operator');
  const projectPeople = useProjectDayPeople(projectId, open && addToDay);
  const projectRoster=useProjectPersonnelRoster(projectId,open);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) { const date = defaultDate ?? localDay(new Date().toISOString(), locations.find(l => l.id === locationId)?.timezone || 'America/Chicago'); setPid(personnelId ?? ""); setLoc(locationId ?? ""); setDay(date); setOutDay(date); setTin(""); setTout(""); setNote(""); }
  }

  const zone = locations.find(l => l.id === loc)?.timezone || (project as { timezone?: string | null } | undefined)?.timezone || 'America/Chicago';
  const { data: roster = [], isLoading: rosterLoading } = useAttendanceRoster(projectId,locationId,day,zone,open);
  const range = manualTimeRange(day, tin, tout, zone, outDay);
  const rosterPeople = roster.map(p => ({ personnel_id: p.personnel_id, first_name: p.personnel?.first_name ?? null, last_name: p.personnel?.last_name ?? null }));
  const currentPeople=(projectRoster.data??[]).map(p=>({personnel_id:p.id,first_name:p.first_name,last_name:p.last_name}));
  const scopedPeople = addToDay ? [...new Map([...currentPeople, ...rosterPeople].map(p => [p.personnel_id, p])).values()] : locationRosterPeople(locationId ? rosterPeople : currentPeople, locationId, roster);
  const valid = !!pid && !!loc && !!day && !!range && (addToDay ? scopedPeople.some(p => p.personnel_id === pid) && (!assign || !!role.trim()) : !locationId || roster.some(p => p.personnel_id === pid));
  const sortedPeople = [...scopedPeople].filter(p => nm(p).toLowerCase().includes(search.toLowerCase())).sort((a, b) => nm(a).localeCompare(nm(b)));
  useEffect(() => { if (open && !defaultDate && !tin && !tout && locations.length) { const date=localDay(new Date().toISOString(),zone);setDay(date);setOutDay(date); } },[open,zone,locations.length,defaultDate,tin,tout]);

  return (
    <Dialog open={open} onOpenChange={o => { if (!save.isPending) onOpenChange(o); }}>
      <DialogContent className="max-w-sm max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>{addToDay ? 'Add person to this day' : 'Log time'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Person</Label>
            {!personnelId&&<AddToProject projectId={projectId}/>}
            {addToDay && <Input aria-label="Search project personnel" placeholder="Search name" value={search} onChange={e => setSearch(e.target.value)} className="mb-2" />}
            {personnelId ? <p className="text-sm font-medium py-2">{personName ?? "Selected person"}</p> : (
              <Select value={pid} onValueChange={setPid} disabled={!!locationId && rosterLoading}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select person" /></SelectTrigger>
                <SelectContent>{!sortedPeople.length&&<SelectItem value="__empty" disabled>No personnel on this project yet</SelectItem>}{sortedPeople.map((p) => <SelectItem key={p.personnel_id} value={p.personnel_id}>{nm(p)}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          {addToDay && pid && !roster.some(p => p.personnel_id === pid && p.assignedOnDay) && <div className="space-y-2"><label className="flex items-center gap-2 text-sm"><Checkbox checked={assign} onCheckedChange={v => setAssign(v === true)} />Assign to this location as of {day}</label>{assign && <div><Label htmlFor="day-role">Role</Label><Input id="day-role" value={role} onChange={e => setRole(e.target.value)} /></div>}</div>}
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
          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          {saveError.includes('unfinished check-out') && <label className="flex gap-2 items-start text-sm"><Checkbox checked={confirmOtherOpen} onCheckedChange={v=>setConfirmOtherOpen(v===true)}/>Confirm these location hours are correct; keep the other site's unfinished punch for supervisor review.</label>}
          {tin && tout && !range && <p className="text-xs text-destructive">Enter valid times with time out after time in.</p>}
          <div><Label>Note (optional)</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid || save.isPending} onClick={async () => { if (!valid || !range) return; try { await save.mutateAsync(
            { personnel_id: pid, location_id: loc, day, in_at: range.inAt, out_at: range.outAt, note, assignRole: addToDay && assign ? role.trim() : undefined, confirmOtherOpen },
          ); onOpenChange(false); } catch(e) { setSaveError(e instanceof Error ? e.message : 'Time could not be saved'); } }}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
