import { useProjectAgencies } from "@/hooks/useProjectAgencies";
import { AgencyFilter } from "./AgencyFilter";
import { exportAgencyHours } from "@/utils/agencyHoursExport";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useProject } from "@/integrations/supabase/hooks/useProjects";
import { pivotTimesheet, useWeekTimesheet } from "@/integrations/supabase/hooks/useTimekeeping";
import { addDays, dayLabel, monthDay, weekDays, type ShiftStarts } from "@/lib/shifts";
import { exportWeekTimesheet } from "@/utils/timesheetExport";
import { toast } from "sonner";

const fmtH = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");

export function TimesheetView({ projectId, projectName, locations, week, setWeek, onPerson }: {
  projectId: string; projectName: string; locations: ({ id: string; name: string } & ShiftStarts)[];
  week: string; setWeek: (w: string) => void; onPerson: (personnelId: string, weekStart: string) => void;
}) {
  const agencies = useProjectAgencies(projectId);
  const [agency, setAgency] = useState("all");
  const [agencyExportOpen, setAgencyExportOpen] = useState(false);
  const [exportVendor, setExportVendor] = useState("");
  const { data: project } = useProject(projectId);
  const p = project as any;
  const locationShifts = useMemo(() => Object.fromEntries(locations.map((l) => [l.id, l])), [locations]);
  const { entries, isLoading } = useWeekTimesheet(projectId, week, p?.day_shift_start, p?.night_shift_start, locationShifts);
  const [shift, setShift] = useState<"all" | "day" | "night">("all");
  const [locId, setLocId] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const days = weekDays(week);

  const filtered = useMemo(() => entries.filter((e) => (!locId || e.location_id === locId) && (agency === "all" || agencies.vendorByPerson[e.personnel_id] === agency)), [entries, locId, agency, agencies.vendorByPerson]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return pivotTimesheet(filtered, shift).filter((r) => !s || r.name.toLowerCase().includes(s));
  }, [filtered, shift, q]);
  const openCount = rows.reduce((n, r) => n + Object.values(r.days).reduce((m, c) => m + c.open, 0), 0);
  const cellH = (c?: { day: number; night: number }) => (c ? (shift === "all" ? c.day + c.night : c[shift]) : 0);
  const colTotals = days.map((d) => rows.reduce((s, r) => s + cellH(r.days[d]), 0));
  const grand = colTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-2 pt-1">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 w-full sm:w-auto">
          <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium px-1 whitespace-nowrap">Mon {monthDay(week)} – Sun {monthDay(addDays(week, 6))}</span>
          <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Next week" onClick={() => setWeek(addDays(week, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Select value={shift} onValueChange={(v) => setShift(v as any)}>
          <SelectTrigger className="h-8 w-[calc(50%-0.25rem)] sm:w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All shifts</SelectItem>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="night">Night</SelectItem>
          </SelectContent>
        </Select>
        <Select value={locId || "all"} onValueChange={(v) => setLocId(v === "all" ? "" : v)}>
          <SelectTrigger className="h-8 w-[calc(50%-0.25rem)] sm:w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search person…" className="h-8 flex-1 min-w-0 sm:flex-none sm:w-[160px]" />
        <AgencyFilter value={agency} onChange={setAgency} vendors={agencies.vendors} />
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-8 gap-1 ml-auto" disabled={busy || !entries.length}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}Download</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
          <DropdownMenuItem onClick={async () => { setBusy(true); try { await exportWeekTimesheet(projectName, week, entries); } catch (e) { toast.error(e instanceof Error ? e.message : "Export failed"); } finally { setBusy(false); } }}>Full week (XLSX)</DropdownMenuItem>
          <DropdownMenuItem disabled={agencies.isLoading || !!agencies.error || !agencies.vendors.length} onClick={() => { setExportVendor(agency !== "all" ? agency : agencies.vendors[0]?.id || ""); setAgencyExportOpen(true); }}>Agency hours (XLSX)</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>

      </div>
      {agencies.error && <p role="alert" className="text-xs text-destructive">Unable to load agencies. Try refreshing.</p>}
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hours this week.</p>
      ) : (
        <TooltipProvider delayDuration={150}>
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-xs tabular-nums">
              <thead className="text-muted-foreground"><tr>
                <th className="sticky left-0 z-10 bg-card text-left py-1 pr-2">Person</th>
                {days.map((d) => <th key={d} className="text-right px-1 whitespace-nowrap"><span className="sm:hidden">{dayLabel(d).slice(0, 2)} {Number(d.slice(8))}</span><span className="hidden sm:inline">{dayLabel(d)}</span></th>)}
                <th className="text-right pl-2">Total</th>
              </tr></thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.personnel_id} className="hover:bg-muted/50 cursor-pointer" onClick={() => onPerson(r.personnel_id, week)}>
                    <td className="sticky left-0 z-10 bg-card py-1.5 pr-2 font-medium whitespace-nowrap max-w-[8.5rem] truncate sm:max-w-none">{r.name}</td>
                    {days.map((d) => {
                      const c = r.days[d]; const h = cellH(c);
                      const both = shift === "all" && c && c.day > 0 && c.night > 0;
                      return (
                        <td key={d} className="text-right px-1 whitespace-nowrap">
                          {h > 0 && (both ? (
                            <Tooltip><TooltipTrigger asChild><span className="underline decoration-dotted">{fmtH(h)}</span></TooltipTrigger>
                              <TooltipContent>D {fmtH(c.day)} / N {fmtH(c.night)}</TooltipContent></Tooltip>
                          ) : fmtH(h))}
                          {c?.open ? <Timer className="inline h-3 w-3 ml-0.5 text-warning" aria-label="Open punch" /> : null}
                        </td>
                      );
                    })}
                    <td className="text-right pl-2 font-semibold">{fmtH(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t font-semibold">
                <td className="sticky left-0 z-10 bg-card py-1.5 pr-2">Total</td>
                {colTotals.map((t, i) => <td key={i} className="text-right px-1">{t ? fmtH(t) : ""}</td>)}
                <td className="text-right pl-2">{fmtH(grand)}</td>
              </tr></tfoot>
            </table>
          </div>
          {openCount > 0 && <p className="text-[11px] text-muted-foreground">⏱ {openCount} open punch{openCount === 1 ? "" : "es"} excluded</p>}
        </TooltipProvider>
      )}
      <Dialog open={agencyExportOpen} onOpenChange={setAgencyExportOpen}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Agency hours</DialogTitle></DialogHeader>
        <AgencyFilter value={exportVendor || "all"} onChange={setExportVendor} vendors={agencies.vendors} />
        <p className="text-xs text-muted-foreground">{monthDay(week)} – {monthDay(addDays(week, 6))}</p>
        <Button disabled={busy || !exportVendor || exportVendor === "all"} onClick={async () => { const vendor = agencies.vendors.find(v => v.id === exportVendor); if (!vendor) return; setBusy(true); try { await exportAgencyHours(vendor, week, entries, agencies.vendorByPerson); setAgencyExportOpen(false); } catch (e) { toast.error(e instanceof Error ? e.message : "Export failed"); } finally { setBusy(false); } }}>Download agency hours</Button>
      </DialogContent></Dialog>
    </div>
  );
}
