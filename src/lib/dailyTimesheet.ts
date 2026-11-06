import { localTime, type SheetRow } from './signinSheets';
import { formatLocalDate } from './dateUtils';
import { stripWhiteBackground } from './signatureInk';

// Customer daily sheets aggregate people; uploaded templates retain their original stay-row semantics.
export function dailyPeople(rows: SheetRow[]): SheetRow[] {
  const people = new Map<string, SheetRow>();
  for (const row of rows) {
    const prior = people.get(row.personnelId);
    if (!prior) { people.set(row.personnelId, { ...row }); continue; }
    prior.inAt = prior.inAt < row.inAt ? prior.inAt : row.inAt;
    prior.outAt = prior.outAt && row.outAt ? (prior.outAt > row.outAt ? prior.outAt : row.outAt) : null;
    prior.hours = prior.hours == null || row.hours == null ? null : prior.hours + row.hours;
    prior.signature ||= row.signature;
    prior.position ||= row.position;
  }
  return [...people.values()].sort((a, b) => a.inAt.localeCompare(b.inAt));
}
export async function generateDailyTimesheet(rows: SheetRow[], config: { day: string; zone: string; projectNumber: string; mission: string; location: string; authorized?: number; approval?: { name: string | null; signature: string | null; at: string | null } }, loadSignature: (path: string) => Promise<ArrayBuffer>) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const people = dailyPeople(rows), widths = [112, 92, 67, 49, 49, 49, 122], left = 36, top = 106, rowH = 30, capacity = 18;
  const headers = ['Employee Name', 'Signature', 'Position', 'Time In', 'Time Out', 'Total Hours', 'Location'];
  const images = new Map<string, Uint8Array>();
  const image = async (path: string, x: number, y: number, w: number, h: number) => {
    let bytes = images.get(path); if (!bytes) { bytes = await stripWhiteBackground(await loadSignature(path)); images.set(path, bytes); }
    const props = pdf.getImageProperties(bytes), scale = Math.min(w / props.width, h / props.height);
    pdf.addImage(bytes, props.fileType, x, y + h - props.height * scale, props.width * scale, props.height * scale);
  };
  const text = (value: string, x: number, y: number, width: number, lines = 3) => { pdf.text(pdf.splitTextToSize(value, width - 8).slice(0, lines), x + 4, y + 11); };
  for (let page = 0; page < Math.max(1, Math.ceil(people.length / capacity)); page++) {
    if (page) pdf.addPage();
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.text('Fairfield Response Group — Daily Timesheet Report', left, 42);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text(`Date: ${formatLocalDate(config.day, 'M/d/yyyy')} | Project: ${config.projectNumber}${config.authorized !== undefined ? ` | Authorized: ${config.authorized}` : ''}`, left, 65);
    pdf.text(pdf.splitTextToSize(`Mission Number: ${config.mission}`, 540).slice(0, 2), left, 82);
    pdf.setFontSize(8); pdf.setLineWidth(0.5);
    let x = left; for (let c = 0; c < widths.length; c++) { pdf.rect(x, top, widths[c], 26); text(headers[c], x, top, widths[c]); x += widths[c]; }
    const chunk = people.slice(page * capacity, (page + 1) * capacity);
    for (let i = 0; i < capacity; i++) {
      const y = top + 26 + i * rowH, row = chunk[i]; x = left;
      const values = row ? [row.name, '', row.position, localTime(row.inAt, config.zone), localTime(row.outAt, config.zone), row.hours == null ? '' : row.hours.toFixed(2), config.location] : headers.map(() => '');
      for (let c = 0; c < widths.length; c++) { pdf.rect(x, y, widths[c], rowH); text(values[c], x, y, widths[c]); if (c === 1 && row?.signature) await image(row.signature, x + 4, y + 3, widths[c] - 8, rowH - 6); x += widths[c]; }
    }
    pdf.setFontSize(9); pdf.text('Customer approval', left, 697);
    pdf.text(`Name: ${config.approval?.name || '________________________'}`, left, 717);
    pdf.text('Signature: ________________________', 245, 717);
    pdf.text(`Date: ${config.approval?.at ? formatLocalDate(config.day, 'M/d/yyyy') : '____________'}`, 466, 717);
    if (config.approval?.signature) await image(config.approval.signature, 294, 700, 132, 23);
    pdf.setFontSize(8); pdf.text(`${config.location} · ${config.zone}`, left, 751); pdf.text(`Page ${page + 1}`, 576, 751, { align: 'right' });
  }
  return new Uint8Array(pdf.output('arraybuffer'));
}