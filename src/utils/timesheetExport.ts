import type { TimesheetEntry } from "@/integrations/supabase/hooks/useTimekeeping";
import { pivotTimesheet } from "@/integrations/supabase/hooks/useTimekeeping";
import { chicagoTime, dayLabel, weekDays } from "@/lib/shifts";
import { supabase } from "@/integrations/supabase/client";
import { roleAt, type RolePeriod } from "@/lib/assignmentRoles";

type DetailExtra = { position: string; late: string; lateReason: string; approval: string };
/** Internal-only enrichment: role in force at check-in (dated history) and late/approval reasons. */
async function detailExtras(entries: TimesheetEntry[]): Promise<Record<string, DetailExtra>> {
  const vpIds = [...new Set(entries.map((e) => e.id.split(":")[0]))];
  const locIds = [...new Set(entries.map((e) => e.location_id))];
  const pIds = [...new Set(entries.map((e) => e.personnel_id))];
  const vp: Record<string, { late_minutes: number | null; late_reason: string | null; late_ack_reason: string | null }> = {};
  for (let i = 0; i < vpIds.length; i += 200) {
    const { data } = await supabase.from("visit_personnel").select("id,late_minutes,late_reason,late_ack_reason").in("id", vpIds.slice(i, i + 200));
    for (const r of data ?? []) vp[r.id] = r;
  }
  const { data: asg } = locIds.length && pIds.length ? await supabase.from("location_assignments").select("id,location_id,personnel_id,role_label").in("location_id", locIds).in("personnel_id", pIds) : { data: [] };
  const asgIds = (asg ?? []).map((a) => a.id);
  const { data: periods } = asgIds.length ? await supabase.from("location_assignment_roles").select("assignment_id,role_label,effective_from").in("assignment_id", asgIds) : { data: [] };
  const out: Record<string, DetailExtra> = {};
  for (const e of entries) {
    const a = (asg ?? []).find((x) => x.location_id === e.location_id && x.personnel_id === e.personnel_id);
    const v = vp[e.id.split(":")[0]];
    out[e.id] = { position: a ? roleAt((periods ?? []) as RolePeriod[], a.id, e.in_at, a.role_label) ?? "" : "", late: v?.late_minutes ? `${v.late_minutes}m` : "", lateReason: v?.late_reason ?? "", approval: v?.late_ack_reason ?? "" };
  }
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const DETAIL_COLS = ["Person", "Location", "Date", "Shift", "Time In", "Time Out", "Hours", "Source"];

function download(buf: ArrayBuffer, name: string) {
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const safe = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "project";

function detailRow(e: TimesheetEntry) {
  return [e.name, e.location_name, dayLabel(e.date), e.shift === "day" ? "Day" : "Night",
    chicagoTime(e.in_at), e.open ? "Open" : chicagoTime(e.out_at), r2(e.hours), e.source];
}

export async function exportWeekTimesheet(projectName: string, weekStart: string, entries: TimesheetEntry[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const days = weekDays(weekStart);
  const head = ["Person", ...days.map(dayLabel), "Total"];

  const matrix = (title: string, shift: "all" | "day" | "night") => {
    const ws = wb.addWorksheet(title);
    ws.addRow(head).font = { bold: true };
    const rows = pivotTimesheet(entries, shift);
    const col = days.map(() => 0);
    for (const p of rows) {
      const vals = days.map((d, i) => {
        const c = p.days[d]; const h = c ? (shift === "all" ? c.day + c.night : c[shift]) : 0;
        col[i] += h; return h ? r2(h) : null;
      });
      ws.addRow([p.name, ...vals, r2(p.total)]);
    }
    const f = ws.addRow(["Total", ...col.map(r2), r2(col.reduce((a, b) => a + b, 0))]); f.font = { bold: true };
    ws.getColumn(1).width = 28;
    for (let i = 2; i <= 9; i++) { ws.getColumn(i).width = 11; ws.getColumn(i).numFmt = "0.00"; }
  };
  matrix("Day Shift", "day");
  matrix("Night Shift", "night");
  matrix("All Hours", "all");

  const det = wb.addWorksheet("Detail");
  const extras = await detailExtras(entries).catch(() => ({} as Record<string, DetailExtra>));
  det.addRow([...DETAIL_COLS, "Position", "Late", "Late reason", "Late approval"]).font = { bold: true };
  [...entries].sort((a, b) => a.name.localeCompare(b.name) || a.in_at.localeCompare(b.in_at)).forEach((e) => { const x = extras[e.id]; det.addRow([...detailRow(e), x?.position ?? "", x?.late ?? "", x?.lateReason ?? "", x?.approval ?? ""]); });
  [28, 24, 11, 8, 11, 11, 9, 14, 16, 8, 24, 30].forEach((w, i) => (det.getColumn(i + 1).width = w));
  det.getColumn(7).numFmt = "0.00";

  const bl = wb.addWorksheet("By Location");
  bl.addRow(["Location", "Person", ...days.map(dayLabel), "Total"]).font = { bold: true };
  const locs = [...new Set(entries.map((e) => e.location_name))].sort();
  for (const loc of locs) {
    const le = entries.filter((e) => e.location_name === loc);
    const h = bl.addRow([loc]); h.font = { bold: true };
    const col = days.map(() => 0);
    for (const p of pivotTimesheet(le)) {
      const vals = days.map((d, i) => { const c = p.days[d]; const v = c ? c.day + c.night : 0; col[i] += v; return v ? r2(v) : null; });
      bl.addRow(["", p.name, ...vals, r2(p.total)]);
    }
    bl.addRow(["", `${loc} total`, ...col.map(r2), r2(col.reduce((a, b) => a + b, 0))]).font = { bold: true };
  }
  bl.getColumn(1).width = 24; bl.getColumn(2).width = 28;
  for (let i = 3; i <= 10; i++) { bl.getColumn(i).width = 11; bl.getColumn(i).numFmt = "0.00"; }

  download(await wb.xlsx.writeBuffer() as ArrayBuffer, `${safe(projectName)}-timesheet-${weekStart}.xlsx`);
}

/** Single-person workbook: detail rows grouped by day with subtotals + total. */
export async function exportPersonTimesheet(personName: string, projectName: string, label: string, entries: TimesheetEntry[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Time Log");
  ws.addRow(DETAIL_COLS).font = { bold: true };
  const sorted = [...entries].sort((a, b) => a.in_at.localeCompare(b.in_at));
  const dates = [...new Set(sorted.map((e) => e.date))];
  let total = 0;
  for (const d of dates) {
    const de = sorted.filter((e) => e.date === d);
    de.forEach((e) => ws.addRow(detailRow(e)));
    const sub = de.reduce((s, e) => s + e.hours, 0); total += sub;
    ws.addRow(["", "", `${dayLabel(d)} subtotal`, "", "", "", r2(sub), ""]).font = { bold: true };
  }
  ws.addRow(["Total", "", "", "", "", "", r2(total), ""]).font = { bold: true };
  [28, 24, 16, 8, 11, 11, 9, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.getColumn(7).numFmt = "0.00";
  download(await wb.xlsx.writeBuffer() as ArrayBuffer, `${safe(personName)}-${safe(projectName)}-${label}.xlsx`);
}
