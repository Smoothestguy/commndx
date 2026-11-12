import { jsPDF } from 'jspdf';
import { formatLocalDate } from './dateUtils';
import { formatChanges, formatTotals, kindLabel, type HistoryRow } from './taskOrderHistory';

/** Header facts printed once at the top (project, location, customer, prime, scope, POC, dates). No dollars. */
export type HistoryHeader = { title: string; fields: [string, string | null | undefined][] };

const when = (r: HistoryRow) => `${formatLocalDate(r.effective_date)}${r.effective_time ? ` ${r.effective_time.slice(0, 5).replace(':', '')}` : ''}`;
const resultText = (r: HistoryRow) => r.fullDemob ? 'Full demobilization — location closes' : `${(r.kind === 'demobilization' || r.kind === 'decrease') ? '→ ' : ''}${formatTotals(r.totals)}${(r.kind === 'demobilization' || r.kind === 'decrease') ? ' remain' : ''}`;
export const historyCells = (r: HistoryRow) => [r.customer_ref ? `${r.number}\nCust: ${r.customer_ref}` : r.number, kindLabel(r.kind) + (r.counts ? '' : ` (${r.status ?? 'not accepted'})`), when(r), formatChanges(r.lines), resultText(r), r.enteredBy ?? ''];
const HEADERS = ['TO #', 'Kind', 'Effective', 'Changes', 'Resulting totals', 'Entered by'];

const ascii = (t: string) => t.replace(/−/g, '-').replace(/→/g, '->').replace(/—/g, '-');
export function printTaskOrderHistory(header: HistoryHeader, rows: HistoryRow[], fileBase: string) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight(), M = 36;
  let y = M;
  const ensure = (h: number) => { if (y + h > H - M) { pdf.addPage(); y = M; } };
  pdf.setFont('helvetica', 'bold').setFontSize(15).text(ascii(header.title), M, y + 12); y += 26;
  pdf.setFontSize(9);
  for (const [label, value] of header.fields.filter(f => f[1])) {
    const lines = pdf.setFont('helvetica', 'normal').splitTextToSize(ascii(String(value)), W - 2 * M - 110) as string[];
    ensure(lines.length * 11 + 2);
    pdf.setFont('helvetica', 'bold').text(`${label}:`, M, y + 9); pdf.setFont('helvetica', 'normal').text(lines, M + 110, y + 9);
    y += lines.length * 11 + 2;
  }
  y += 8;
  const widths = [70, 95, 85, 175, 175, W - 2 * M - 600];
  const row = (cells: string[], bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(9);
    const wrapped = cells.map((c, i) => pdf.splitTextToSize(ascii(c), widths[i] - 8) as string[]);
    const h = Math.max(...wrapped.map(w => w.length)) * 11 + 8;
    ensure(h);
    let x = M;
    wrapped.forEach((w, i) => { pdf.rect(x, y, widths[i], h); pdf.text(w, x + 4, y + 13); x += widths[i]; });
    y += h;
  };
  row(HEADERS, true);
  for (const r of rows) row(historyCells(r));
  y += 14;
  for (const r of rows) {
    const extra = [r.edited ? `Edit: ${r.edited}` : '', r.customer_ref ? `Customer TO / Sidemark: ${r.customer_ref}` : '', r.notes ? `Notes: ${r.notes}` : '', r.travel_time != null ? `Travel time: ${r.travel_time ? 'Yes' : 'No'}` : '', ...Object.entries(r.details ?? {}).map(([k, v]) => `${k}: ${v}`)].filter(Boolean);
    const body = pdf.setFont('helvetica', 'normal').setFontSize(9).splitTextToSize(ascii(extra.join('\n')) || 'No notes or details.', W - 2 * M) as string[];
    ensure(body.length * 11 + 44);
    pdf.setFont('helvetica', 'bold').text(ascii(`${r.number} - ${kindLabel(r.kind)} - effective ${when(r)}`), M, y + 10); y += 16;
    pdf.setFont('helvetica', 'normal').text(body, M, y + 9); y += body.length * 11 + 6;
    pdf.text(`Entered by: ${r.enteredBy || '—'}      Signature: ______________________________`, M, y + 9); y += 22;
  }
  pdf.setFontSize(8).text(`Generated ${new Date().toLocaleString('en-GB', { hourCycle: 'h23' })}`, M, H - 16);
  pdf.save(`${fileBase}.pdf`);
  return pdf;
}

export async function exportTaskOrderHistoryXlsx(header: HistoryHeader, rows: HistoryRow[], fileBase: string) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Task orders');
  ws.addRow([header.title]).font = { bold: true, size: 14 };
  for (const [k, v] of header.fields.filter(f => f[1])) ws.addRow([k, v]);
  ws.addRow([]);
  ws.addRow([...HEADERS, 'Notes', 'Travel time', 'Details']).font = { bold: true };
  for (const r of rows) ws.addRow([...historyCells(r), r.notes ?? '', r.travel_time == null ? '' : r.travel_time ? 'Yes' : 'No', Object.entries(r.details ?? {}).map(([k, v]) => `${k}: ${v}`).join('; ')]);
  ws.columns.forEach((c, i) => { c.width = [12, 16, 14, 30, 34, 22, 40, 12, 40][i] ?? 16; });
  const blob = new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${fileBase}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
