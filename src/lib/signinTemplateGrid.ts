import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

/** Remove the spreadsheet-export grid, not the intentionally ruled table.
 * Recognize the legacy letter template's drawing geometry and translucent
 * grid group. Never rewrite storage originals or unrelated customer PDFs.
 */
export async function cleanSigninTemplateGrid(original: ArrayBuffer): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(original);
  let changed = false;
  for (const page of pdf.getPages()) {
    if (page.getWidth() !== 612 || page.getHeight() !== 792) continue;
    const states = page.node.Resources()?.lookup(PDFName.of('ExtGState'));
    if (!(states instanceof PDFDict)) continue;
    const gridState = states.lookup(PDFName.of('Gs1'));
    if (!(gridState instanceof PDFDict) || String(gridState.get(PDFName.of('ca'))) !== '0.149') continue;
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map(ref => pdf.context.lookup(ref)) : [contents];
    for (const stream of streams) {
      if (!(stream instanceof PDFRawStream)) continue;
      const text = Array.from(decodePDFRawStream(stream).decode(), byte => String.fromCharCode(byte)).join('');
      // The seven-column table and its logo have this export transform. The
      // stray grid is a separate filled path group (no text/images/strokes).
      if (!/0\.5148036\s+0\s+0\s+-0\.5148036\s+50\.4\s+738\s+cm/.test(text)) continue;
      const cleaned = text.replace(/(\/Gs1\s+gs\s+)([\d.\smlh-]+)f\b/, (match, state: string, paths: string) => {
        if (!paths.trim().startsWith('50.4 738 m') || (paths.match(/\bh\b/g)?.length ?? 0) < 100) return match;
        changed = true;
        return state;
      });
      if (cleaned === text) continue;
      // Latin-1 preserves embedded font bytes; TextEncoder would corrupt them.
      const replacement = pdf.context.flateStream(Uint8Array.from(cleaned, c => c.charCodeAt(0)));
      if (contents instanceof PDFArray) {
        for (let i = 0; i < contents.size(); i++) {
          if (pdf.context.lookup(contents.get(i)) === stream) contents.set(i, pdf.context.register(replacement));
        }
      } else page.node.set(PDFName.of('Contents'), pdf.context.register(replacement));
    }
  }
  return changed ? pdf.save() : new Uint8Array(original);
}