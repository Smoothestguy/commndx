import { localDay, localTime } from './signinSheets';
import { stripWhiteBackground } from './signatureInk';
export async function countersignSheet(bytes: Uint8Array, signature: ArrayBuffer, name: string, at: string, zone: string, builtIn = false) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.load(bytes); const font = await pdf.embedFont(StandardFonts.Helvetica); const image = await pdf.embedPng(await stripWhiteBackground(signature));
  const cleanName = (s: string) => Array.from(s).map(c => { try { font.encodeText(c); return c; } catch { return '?'; } }).join('').slice(0, 32);
  if (builtIn) for (const original of pdf.getPages()) {
    original.drawRectangle({ x: 36, y: 60, width: 540, height: 28, color: rgb(1, 1, 1) });
    original.drawText(`Name: ${cleanName(name)}`, { x: 36, y: 75, size: 9, font });
    original.drawText('Signature:', { x: 245, y: 75, size: 9, font });
    const fit = image.scaleToFit(132, 23); original.drawImage(image, { x: 294, y: 69, ...fit });
    original.drawText(`Date: ${localDay(at, zone)}`, { x: 466, y: 75, size: 8, font });
  }
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
