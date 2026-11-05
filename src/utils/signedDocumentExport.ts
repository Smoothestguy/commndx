import { supabase } from '@/integrations/supabase/client';
import { stampDocument, type SignField } from '@/lib/documentStamp';
import { loadDocumentFields } from '@/lib/documentSignFields';
import type { DocumentSignature } from '@/integrations/supabase/hooks/useDocumentSignatures';
import type { ProjectDocument } from '@/integrations/supabase/hooks/useProjectDocuments';
export async function signatureImageUrl(path: string) {
  // Persist private object paths, never expired signed URLs.
  const objectPath = path.includes('/project-documents/') ? decodeURIComponent(path.split('/project-documents/')[1].split('?')[0]) : path;
  const { data, error } = await supabase.storage.from('project-documents').createSignedUrl(objectPath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
export async function generateSignedDocument(doc: ProjectDocument, signature: DocumentSignature, projectName: string, shared?: { original: ArrayBuffer; fields: SignField[] }) {
  if (!signature.signature_url || !signature.signed_at) throw new Error('Signature is not available');
  const [source, imageUrl] = await Promise.all([shared || signedDocumentSource(doc), signatureImageUrl(signature.signature_url)]);
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('Signature image unavailable');
  return stampDocument(source.original, await response.arrayBuffer(), source.fields, { name: signature.sign_name || signature.name, signedAt: signature.signed_at, documentName: doc.file_name, projectName, reference: signature.id, lat: signature.sign_lat, lng: signature.sign_lng });
}
async function signedDocumentSource(doc: ProjectDocument) {
  const [{ data, error }, fields] = await Promise.all([supabase.storage.from('project-documents').download(doc.file_path), loadDocumentFields(doc.id)]);
  if (error || !data) throw error || new Error('PDF unavailable');
  return { original: await data.arrayBuffer(), fields };
}
const safeName = (name: string) => name.replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/^\.+/, '').trim() || 'signer';
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function downloadSignedDocument(doc: ProjectDocument, signature: DocumentSignature, projectName: string) {
  const bytes = await generateSignedDocument(doc, signature, projectName);
  saveBlob(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), `${safeName(doc.file_name.replace(/\.pdf$/i, ''))}-${safeName(signature.sign_name || signature.name)}-signed.pdf`);
}
export async function downloadAllSignedDocuments(doc: ProjectDocument, rows: DocumentSignature[], projectName: string) {
  const signed = rows.filter(r => r.status === 'signed');
  if (signed.length < 2) return;
  const [{ default: JSZip }, source] = await Promise.all([import('jszip'), signedDocumentSource(doc)]);
  const zip = new JSZip();
  // Sequential generation bounds memory; IDs avoid overwriting same-named signers.
  for (const row of signed) zip.file(`${safeName(doc.file_name.replace(/\.pdf$/i, ''))}-${safeName(row.sign_name || row.name)}-${row.id}-signed.pdf`, await generateSignedDocument(doc, row, projectName, source));
  saveBlob(await zip.generateAsync({ type: 'blob' }), `${safeName(doc.file_name.replace(/\.pdf$/i, ''))}-all-signed.zip`);
}
