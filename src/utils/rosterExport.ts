export interface RosterExportRow {
  location: string; projectNumber: string; name: string; role: string; status: string;
  phone?: string; texted: string; hours: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const safe = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "project";
export const rosterFileBase = (projectName: string, date: string) => `${safe(projectName)}-roster-${date}`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const headers = (withPhone: boolean) =>
  ["Location", "Project #", "Name", "Role", "Status", ...(withPhone ? ["Phone"] : []), "Texted", "Hours this week"];
const cells = (r: RosterExportRow, withPhone: boolean) =>
  [r.location, r.projectNumber, r.name, r.role, r.status, ...(withPhone ? [r.phone ?? ""] : []), r.texted, r2(r.hours)];

export function exportRosterCsv(rows: RosterExportRow[], withPhone: boolean, fileBase: string) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers(withPhone), ...rows.map((r) => cells(r, withPhone).map((c) => typeof c === "number" ? c.toFixed(2) : c))]
    .map((l) => l.map(esc).join(","));
  download(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${fileBase}.csv`);
}

export async function exportRosterXlsx(rows: RosterExportRow[], withPhone: boolean, fileBase: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Roster");
  const h = headers(withPhone);
  ws.addRow(h).font = { bold: true };
  for (const r of rows) ws.addRow(cells(r, withPhone));
  const total = h.map(() => "" as string | number);
  total[0] = "Total"; total[2] = `${rows.length} ${rows.length === 1 ? "person" : "people"}`;
  total[h.length - 1] = r2(rows.reduce((t, r) => t + r.hours, 0));
  ws.addRow(total).font = { bold: true };
  const widths: Record<string, number> = { Location: 32, "Project #": 11, Name: 26, Role: 18, Status: 26, Phone: 16, Texted: 10, "Hours this week": 15 };
  h.forEach((k, i) => { ws.getColumn(i + 1).width = widths[k] ?? 14; });
  ws.getColumn(h.length).numFmt = "0.00";
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileBase}.xlsx`);
}
