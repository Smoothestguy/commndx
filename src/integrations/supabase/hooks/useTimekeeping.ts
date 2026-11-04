import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, chicagoParts, chicagoMidnight, classifyShift, resolveShiftStarts, splitAtMidnight, Shift, LocationShiftMap } from "@/lib/shifts";

const db = supabase as any;

export type EntrySource = "Manual" | "Self check-in" | "Supervisor";

export interface TimesheetEntry {
  id: string;
  personnel_id: string;
  name: string;
  location_id: string;
  location_name: string;
  visit_id: string;
  in_at: string;
  out_at: string | null;
  date: string; // Chicago local date
  shift: Shift;
  hours: number; // 0 when open
  open: boolean;
  source: EntrySource;
}

export type DayCell = { day: number; night: number; open: number };

export function sourceFromNotes(notes: string | null | undefined): EntrySource {
  if (/^manual entry/i.test(notes ?? "")) return "Manual";
  if (/self check-in/i.test(notes ?? "")) return "Self check-in";
  return "Supervisor";
}

/** One query for the week's trail + visit notes; returns classified entries. */
export function useWeekTimesheet(projectId: string | undefined, weekStartDate: string, dayStart?: string | null, nightStart?: string | null, locationShifts: LocationShiftMap = {}) {
  const q = useQuery({
    queryKey: ["week-timesheet", projectId, weekStartDate],
    enabled: !!projectId,
    queryFn: async () => {
      // Include stays starting before the week whose checkout overlaps it.
      const from = chicagoMidnight(weekStartDate);
      const { data, error } = await db.from("personnel_location_trail")
        .select("visit_personnel_id, personnel_id, first_name, last_name, visit_id, location_id, location_name, in_at, out_at, hours")
        .eq("project_id", projectId)
        .or(`out_at.is.null,out_at.gte.${from}`)
        .lt("in_at", chicagoMidnight(addDays(weekStartDate, 7)))
        .order("in_at").limit(5000);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const ids = [...new Set(rows.map((r) => r.visit_id).filter(Boolean))];
      const notes: Record<string, string | null> = {};
      for (let i = 0; i < ids.length; i += 200) {
        const { data: v, error: e } = await db.from("location_visits").select("id, notes").in("id", ids.slice(i, i + 200));
        if (e) throw e;
        for (const r of v ?? []) notes[r.id] = r.notes;
      }
      return { rows, notes };
    },
  });

  const entries = useMemo<TimesheetEntry[]>(() => {
    if (!q.data) return [];
    const end = addDays(weekStartDate, 6);
    const out: TimesheetEntry[] = [];
    for (const r of q.data.rows) {
      const open = !r.out_at;
      const starts = resolveShiftStarts(locationShifts[r.location_id], { day_shift_start: dayStart, night_shift_start: nightStart });
      const segments = open ? [{ date: chicagoParts(r.in_at).date, hours: 0 }] : splitAtMidnight(r.in_at, r.out_at);
      for (const segment of segments) {
        if (segment.date < weekStartDate || segment.date > end) continue;
        out.push({
        id: `${r.visit_personnel_id}:${segment.date}`,
        personnel_id: r.personnel_id,
        name: [r.first_name, r.last_name].filter(Boolean).join(" ") || "Unknown",
        location_id: r.location_id,
        location_name: r.location_name ?? "—",
        visit_id: r.visit_id,
        in_at: r.in_at,
        out_at: r.out_at,
        date: segment.date,
        shift: classifyShift(r.in_at, starts.day, starts.night),
        hours: segment.hours,
        open,
        source: sourceFromNotes(q.data.notes[r.visit_id]),
      });
      }
    }
    return out;
  }, [q.data, weekStartDate, dayStart, nightStart, locationShifts]);

  return { ...q, entries };
}

export interface PivotRow { personnel_id: string; name: string; days: Record<string, DayCell>; total: number }

/** person → day → {day, night, open}, sorted by name. */
export function pivotTimesheet(entries: TimesheetEntry[], shift: "all" | Shift = "all"): PivotRow[] {
  const m = new Map<string, PivotRow>();
  for (const e of entries) {
    if (shift !== "all" && e.shift !== shift) continue;
    let p = m.get(e.personnel_id);
    if (!p) { p = { personnel_id: e.personnel_id, name: e.name, days: {}, total: 0 }; m.set(e.personnel_id, p); }
    const c = (p.days[e.date] ??= { day: 0, night: 0, open: 0 });
    if (e.open) c.open++;
    else { c[e.shift] += e.hours; p.total += e.hours; }
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}
