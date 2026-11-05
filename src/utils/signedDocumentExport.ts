import { supabase } from '@/integrations/supabase/client';
import { signatureTime } from '@/lib/documentSign';
import type { DocumentSignature } from '@/integrations/supabase/hooks/useDocumentSignatures';
import type { ProjectDocument } from '@/integrations/supabase/hooks/useProjectDocuments';
export async function signatureImageUrl(path: string) {
  // Persist private object paths, never expired signed URLs.
  const objectPath = path.includes('/field-captures/') ? decodeURIComponent(path.split('/field-captures/')[1].split('?')[0]) : path;
  const { data, error } = await supabase.storage.from('field-captures').createSignedUrl(objectPath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
export async function downloadSignedDocument(doc: ProjectDocument, signature: DocumentSignature, projectName: string) {
  if (!signature.signature_url || !signature.signed_at) throw new Error('Signature is not available');
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const [{ data: original, error }, imageUrl] = await Promise.all([supabase.storage.from('project-documents').download(doc.file_path), signatureImageUrl(signature.signature_url)]);
  if (error || !original) throw error || new Error('PDF unavailable');
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('Signature image unavailable');
  const pdf = await PDFDocument.load(await original.arrayBuffer());
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  // Standard PDF fonts cannot encode arbitrary Unicode; replace unsupported glyphs safely.
  const printable = (text: string) => Array.from(text).map(char => { try { font.encodeText(char); return char; } catch { return '?'; } }).join('');
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
  line(`Document: ${doc.file_name}`); line(`Project: ${projectName}`);
  line(`Signer: ${signature.sign_name || signature.name}`);
  line(`Signed: ${signatureTime(signature.signed_at)}`);
  if (signature.sign_lat != null && signature.sign_lng != null) line(`GPS: ${signature.sign_lat}, ${signature.sign_lng}`);
  line(`Reference: ${signature.id}`);
  const png = await pdf.embedPng(await response.arrayBuffer());
  const size = png.scaleToFit(480, 180);
  page.drawImage(png, { x: 50, y: y - size.height - 10, width: size.width, height: size.height });
  const bytes = await pdf.save();
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = `${doc.file_name.replace(/\.pdf$/i, '')}-${(signature.sign_name || signature.name).replace(/[^\p{L}\p{N} -]/gu, '')}-signed.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
