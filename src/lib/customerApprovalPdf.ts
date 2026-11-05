import { localDay, localTime } from './signinSheets';
export async function countersignSheet(bytes: Uint8Array, signature: ArrayBuffer, name: string, at: string, zone: string) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.load(bytes); const font = await pdf.embedFont(StandardFonts.Helvetica); const image = await pdf.embedPng(signature);
  // Dedicated approval page avoids covering first-row/overflow evidence on arbitrary templates.
  const page = pdf.addPage([612, 792]); const clean = (s: string) => Array.from(s).map(c => { try { font.encodeText(c); return c; } catch { return '?'; } }).join('');
  page.drawText('Customer approval', { x: 48, y: 716, size: 20, font });
  const lines = clean(`Customer approval: ${name}`).match(/.{1,65}/g) || [];
  lines.forEach((line, i) => page.drawText(line, { x: 48, y: 675 - i * 16, size: 11, font }));
  page.drawText(`${localDay(at, zone)} ${localTime(at, zone)} (${zone})`, { x: 48, y: 615, size: 10, font });
  const fit = image.scaleToFit(250, 95); page.drawImage(image, { x: 314, y: 485, ...fit });
  page.drawLine({ start: { x: 314, y: 477 }, end: { x: 564, y: 477 }, thickness: 1, color: rgb(0.5, 0.5, 0.5) });
  return pdf.save();
}
