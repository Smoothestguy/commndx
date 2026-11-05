export type SignFieldKind = 'signature' | 'name' | 'date';
export interface SignField { id: string; page: number; x_pct: number; y_pct: number; w_pct: number; kind: string; }

export const stampedDate = (iso: string) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'numeric', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const part = (name: string) => parts.find(p => p.type === name)?.value || '';
  return `${part('month')}/${part('day')}/${part('year')} ${part('hour')}:${part('minute')} CT`;
};

// Stored y_pct is measured from the TOP of the displayed page, never PDF bottom-left.
export function stampRect(field: Pick<SignField, 'x_pct' | 'y_pct' | 'w_pct'>, width: number, height: number, aspect: number) {
  const w = field.w_pct * width, h = w / aspect;
  return { x: field.x_pct * width, y: height - field.y_pct * height - h, width: w, height: h };
}

export function newSignField(page: number, x: number, y: number, width: number, height: number, kind: SignFieldKind): SignField {
  const w_pct = 0.25;
  return { id: crypto.randomUUID(), page, kind, w_pct, x_pct: Math.max(0, Math.min(1 - w_pct, x / width)), y_pct: Math.max(0, Math.min(1 - w_pct * width / (3 * height), y / height)) };
}

export async function stampDocument(original: ArrayBuffer, pngBytes: ArrayBuffer, fields: SignField[], evidence: { name: string; signedAt: string; documentName: string; projectName: string; reference: string; lat?: number | null; lng?: number | null }) {
  const { PDFDocument, StandardFonts, pushGraphicsState, popGraphicsState, concatTransformationMatrix } = await import('pdf-lib');
  const pdf = await PDFDocument.load(original);
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const png = await pdf.embedPng(pngBytes);
  const printable = (text: string) => Array.from(text).map(char => { try { font.encodeText(char); return char; } catch { return '?'; } }).join('');
  const originals = pdf.getPages();
  for (const field of fields) {
    const page = originals[field.page - 1];
    if (!page || !Number.isInteger(field.page) || ![field.x_pct, field.y_pct, field.w_pct].every(Number.isFinite) || field.x_pct < 0 || field.y_pct < 0 || field.w_pct <= 0 || field.x_pct + field.w_pct > 1.00001 || field.y_pct >= 1) throw new Error('A signature field is outside the PDF. Please place the fields again.');
    const crop = page.getCropBox();
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;
    const sideways = rotation === 90 || rotation === 270;
    const width = sideways ? crop.height : crop.width, height = sideways ? crop.width : crop.height;
    // Match PDF.js's displayed crop/rotation, then translate top-origin field positions
    // into visual bottom-left coordinates before mapping into the original PDF space.
    const matrix: [number, number, number, number, number, number] = rotation === 90 ? [0, 1, -1, 0, crop.x + crop.width, crop.y] : rotation === 180 ? [-1, 0, 0, -1, crop.x + crop.width, crop.y + crop.height] : rotation === 270 ? [0, -1, 1, 0, crop.x, crop.y + crop.height] : [1, 0, 0, 1, crop.x, crop.y];
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...matrix));
    if (field.kind === 'signature') {
      const rect = stampRect(field, width, height, png.width / png.height);
      if (rect.y < 0) throw new Error('Signature extends past the page. Move the field upward.');
      page.drawImage(png, rect);
    } else if (field.kind === 'name' || field.kind === 'date') {
      const text = printable(field.kind === 'name' ? evidence.name : stampedDate(evidence.signedAt));
      const size = Math.min(10, field.w_pct * width / Math.max(1, font.widthOfTextAtSize(text, 1)));
      page.drawText(text, { x: field.x_pct * width, y: height - field.y_pct * height - size, size, font });
    } else throw new Error('Unknown signature field type');
    page.pushOperators(popGraphicsState());
  }
  const page = pdf.addPage([612, 792]);
  let y = 735;
  const line = (text: string, heading = false) => {
    const words = printable(text).split(/\s+/); let row = '';
    for (const word of words) {
      const next = row ? `${row} ${word}` : word;
      if (font.widthOfTextAtSize(next, 11) > 500 && row) { page.drawText(row, { x: 50, y, size: 11, font: heading ? bold : font }); y -= 20; row = word; } else row = next;
    }
    page.drawText(row, { x: 50, y, size: 11, font: heading ? bold : font }); y -= 28;
  };
  line('Signature certificate', true);
  line(`Document: ${evidence.documentName}`); line(`Project: ${evidence.projectName}`);
  line(`Signer: ${evidence.name}`); line(`Signed: ${stampedDate(evidence.signedAt)}`);
  if (evidence.lat != null && evidence.lng != null) line(`GPS: ${evidence.lat}, ${evidence.lng}`);
  line(`Reference: ${evidence.reference}`);
  const size = png.scaleToFit(480, 180);
  page.drawImage(png, { x: 50, y: y - size.height - 10, width: size.width, height: size.height });
  return pdf.save();
}