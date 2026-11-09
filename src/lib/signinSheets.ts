import type { SignField } from './documentStamp';
import { stripWhiteBackground } from './signatureInk';
export const localDay = (iso: string, zone: string) => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  return `${p.find(x => x.type === 'year')?.value}-${p.find(x => x.type === 'month')?.value}-${p.find(x => x.type === 'day')?.value}`;
};
/** Always "HH:mm" (24h). Built from parts so engines that ignore hourCycle or emit "24" still match the HH:mm inputs. */
export const localTime = (iso: string | null, zone: string) => {
  if (!iso) return '';
  const d = new Date(iso); if (!Number.isFinite(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(d);
  const h = Number(parts.find(p => p.type === 'hour')?.value) % 24, m = parts.find(p => p.type === 'minute')?.value ?? '00';
  return `${String(Number.isFinite(h) ? h : 0).padStart(2, '0')}:${m.padStart(2, '0')}`;
};
export function nextDay(day: string) { return new Date(Date.parse(`${day}T12:00:00Z`) + 86400000).toISOString().slice(0, 10); }
export function midnight(day: string, zone: string) {
  const target = Date.parse(`${day}T00:00:00Z`); let t = target;
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t));
    const p = (v: string) => parts.find(x => x.type === v)?.value;
    const seen = Date.parse(`${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}:${p('second')}Z`);
    t += target - seen;
  }
  return t;
}
export type SheetStay = { id: string; personnelId: string; locationId: string; name: string; position: string; inAt: string; outAt: string | null; signature: string | null; signaturesByDay?: Record<string, string>; offsite: boolean };
export type SheetRow = SheetStay & { day: string; hours: number | null };
export function rowsForDay(stays: SheetStay[], locationId: string, day: string, zone: string, now = Date.now()): SheetRow[] {
  const start = midnight(day, zone), end = midnight(nextDay(day), zone);
  // Each person's first signed check-in of this local day at this location signs all of their rows that day.
  const firstSigned = new Map<string, string>();
  for (const s of [...stays].filter(s => s.locationId === locationId && localDay(s.inAt, zone) === day && (s.signature || s.signaturesByDay?.[day])).sort((a, b) => a.inAt.localeCompare(b.inAt)))
    if (!firstSigned.has(s.personnelId)) firstSigned.set(s.personnelId, (s.signature || s.signaturesByDay?.[day])!);
  return stays.filter(s => s.locationId === locationId && Date.parse(s.inAt) < end && (s.outAt ? Date.parse(s.outAt) : now) > start).map(s => {
    const from = Math.max(start, Date.parse(s.inAt));
    const to = Math.min(end, s.outAt ? Date.parse(s.outAt) : now);
    const closed = !!s.outAt || end <= now;
    const signature = day === localDay(s.inAt, zone) ? s.signature || s.signaturesByDay?.[day] || null : s.signaturesByDay?.[day] || null;
    const daySignature = signature || firstSigned.get(s.personnelId) || null;
    return { ...s, signature: daySignature, day, inAt: new Date(from).toISOString(), outAt: closed ? new Date(to).toISOString() : null, hours: closed ? Math.max(0, (to - from) / 3600000) : null };
  }).sort((a, b) => a.inAt.localeCompare(b.inAt) || a.id.localeCompare(b.id));
}
export const sheetFileName = (location: string, day: string) => `${location.replace(/[^\p{L}\p{N} ._-]/gu, '').trim() || 'location'}-${day}.pdf`;
export async function generateSigninSheet(original: ArrayBuffer, fields: SignField[], rows: SheetRow[], config: { rowsPerPage: number; rowHeight: number; zone: string; day: string; project: string; mission: string; location: string; address: string }, loadSignature: (path: string) => Promise<ArrayBuffer>) {
  const { PDFDocument, StandardFonts, pushGraphicsState, popGraphicsState, concatTransformationMatrix } = await import('pdf-lib');
  if (!Number.isInteger(config.rowsPerPage) || config.rowsPerPage < 1 || config.rowsPerPage > 100 || config.rowHeight <= 0 || config.rowHeight > 1) throw new Error('Invalid row band settings');
  if (!fields.some(f => f.scope === 'row')) throw new Error('Place row fields before generating sheets');
  const source = await PDFDocument.load(original), output = await PDFDocument.create();
  const font = await output.embedFont(StandardFonts.Helvetica);
  const clean = (text: string) => Array.from(text).map(c => { try { font.encodeText(c); return c; } catch { return '?'; } }).join('');
  const images = new Map<string, Awaited<ReturnType<typeof output.embedPng>>>();
  const ordered = [...rows].sort((a,b) => a.inAt.localeCompare(b.inAt) || a.id.localeCompare(b.id));
  const rowFields = fields.filter(f => f.scope === 'row');
  // Legacy placed boxes may be taller than their row band: fit the ink/text inside
  // the band's height without moving the saved top-left or changing source fields.
  const fieldHeight=(f:SignField)=>f.scope==='row'?Math.min(f.h_pct ?? config.rowHeight,config.rowHeight):f.h_pct ?? 0.04;
  const capacity = Math.min(config.rowsPerPage, ...rowFields.map(f => Math.floor((1 - f.y_pct - fieldHeight(f) + 0.000001) / config.rowHeight) + 1));
  if (capacity < 1) throw new Error('No template rows fit on the page');
  const chunks = Math.max(1, Math.ceil(ordered.length / capacity));
  for (let chunk = 0; chunk < chunks; chunk++) {
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach(p => output.addPage(p));
    for (const field of fields) {
      const page = pages[field.page - 1]; if (!page) throw new Error('Field page missing from template');
      const crop = page.getCropBox(), angle = ((page.getRotation().angle % 360) + 360) % 360;
      const width = angle === 90 || angle === 270 ? crop.height : crop.width, height = angle === 90 || angle === 270 ? crop.width : crop.height;
      const matrix: [number, number, number, number, number, number] = angle === 90 ? [0, 1, -1, 0, crop.x + crop.width, crop.y] : angle === 180 ? [-1, 0, 0, -1, crop.x + crop.width, crop.y + crop.height] : angle === 270 ? [0, -1, 1, 0, crop.x, crop.y + crop.height] : [1, 0, 0, 1, crop.x, crop.y];
      const band = field.scope === 'row' ? ordered.slice(chunk * capacity, (chunk + 1) * capacity) : [null];
      for (let i = 0; i < band.length; i++) {
        const row = band[i], yPct = field.y_pct + (row ? i * config.rowHeight : 0), hPct = fieldHeight(field);
        if (![field.x_pct, yPct, field.w_pct, hPct].every(Number.isFinite) || field.x_pct < 0 || field.w_pct <= 0 || hPct <= 0 || yPct < 0 || field.x_pct + field.w_pct > 1.00001 || yPct + hPct > 1.00001) throw new Error('Fields or row bands extend beyond the page');
        const values: Record<string, string> = { date: config.day, project_name: config.project, mission_number: config.mission, location_name: config.location, location_address: config.address, employee_name: row?.name ?? '', name: row?.name ?? '', position: row?.position ?? '', time_in: row ? localTime(row.inAt, config.zone) : '', time_out: row ? localTime(row.outAt, config.zone) : '', total_hours: row?.hours == null ? '' : row.hours.toFixed(2) };
        page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...matrix));
        const x = field.x_pct * width, bottom = height * (1 - yPct - hPct), w = field.w_pct * width, h = hPct * height;
        if ((field.binding || field.kind) === 'signature' && row?.signature) {
          let image = images.get(row.signature);
          if (!image) { image = await output.embedPng(await stripWhiteBackground(await loadSignature(row.signature))); images.set(row.signature, image); }
          // 90% of the cell, centered: fills like a pen signature while keeping a margin inside the borders.
          page.drawImage(image, fitSignatureInCell({ x, y: bottom, width: w, height: h }, image));
        } else {
          const text = clean(values[field.binding || field.kind] ?? '');
          if (text) { const size = Math.min(10, h * 0.75, Math.max(1,w-4) / Math.max(1, font.widthOfTextAtSize(text, 1))); page.drawText(text, { x, y: bottom + (h - size) / 2, font, size }); }
        }
        page.pushOperators(popGraphicsState());
      }
    }
  }
  return output.save();
}