import { supabase } from '@/integrations/supabase/client';
import { loadDocumentFields, saveDocumentFields } from './documentSignFields';
import { localDay, type SheetStay } from './signinSheets';
import type { ProjectDocument } from '@/integrations/supabase/hooks/useProjectDocuments';
import type { ProjectLocation } from '@/integrations/supabase/hooks/useProjectLocations';
import { signatureImageUrl } from '@/utils/signedDocumentExport';

export async function linkTemplate(documentId: string, locationIds: string[]) {
  const unique = [...new Set(locationIds)];
  if (unique.length) {
    const { error } = await supabase.from('document_locations').upsert(unique.map(location_id => ({ document_id: documentId, location_id })), { onConflict: 'document_id,location_id' });
    if (error) throw error;
  }
  const { data, error } = await supabase.from('document_locations').select('location_id').eq('document_id', documentId);
  if (error) throw error;
  for (const row of data ?? []) if (!unique.includes(row.location_id)) {
    const { error: removeError } = await supabase.from('document_locations').delete().eq('document_id', documentId).eq('location_id', row.location_id);
    if (removeError) throw removeError;
  }
}
export async function copySigninTemplate(source: ProjectDocument, projectId: string, locationIds: string[]) {
  const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Sign in required');
  const fields = await loadDocumentFields(source.id);
  const { data, error } = await supabase.from('project_documents').insert({ project_id: projectId, file_name: source.file_name, file_path: source.file_path, file_size: source.file_size, file_type: source.file_type, uploaded_by: user.id, is_signin_template: true, is_reusable_template: false, requires_signature: false, rows_per_page: source.rows_per_page ?? 12, row_height_pct: source.row_height_pct ?? 0.045, notes: source.notes }).select().single();
  if (error) throw error;
  try { await saveDocumentFields(data.id, fields.map(f => ({ ...f, id: crypto.randomUUID() }))); await linkTemplate(data.id, locationIds); }
  catch (e) { await supabase.from('project_documents').delete().eq('id', data.id); throw e; }
  return data;
}
export async function convertBlankSigninTemplate(doc: ProjectDocument) {
  const fields = await loadDocumentFields(doc.id);
  await saveDocumentFields(doc.id, fields.map(f => (f.binding === 'name' || f.kind === 'name') ? { ...f, binding: 'employee_name', scope: 'row' } : (f.binding === 'signature' || f.kind === 'signature') ? { ...f, binding: 'signature', scope: 'row' } : f));
  const { error } = await supabase.from('project_documents').update({ is_signin_template: true, rows_per_page: doc.rows_per_page ?? 12, row_height_pct: doc.row_height_pct ?? 0.045 }).eq('id', doc.id);
  if (error) throw error;
  // No changes to document_signatures, original file or signed evidence.
}
async function allRows<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let offset = 0; ; offset += 500) { const { data, error } = await query(offset, offset + 499); if (error) throw error; out.push(...data ?? []); if ((data ?? []).length < 500) return out; }
}
export async function loadSheetStays(projectId: string, locations: ProjectLocation[], from: string, to: string): Promise<SheetStay[]> {
  // Wide UTC window is intentionally filtered again by location-local day in the pure sheet layer.
  const lower = new Date(Date.parse(`${from}T00:00:00Z`) - 86400000).toISOString();
  const upper = new Date(Date.parse(`${to}T00:00:00Z`) + 2 * 86400000).toISOString();
  const trail = await allRows((a, b) => supabase.from('personnel_location_trail').select('*').eq('project_id', projectId).lt('in_at', upper).or(`out_at.is.null,out_at.gte.${lower}`).order('in_at').order('visit_personnel_id').range(a, b));
  const ids = trail.flatMap(r => r.visit_personnel_id ? [r.visit_personnel_id] : []), locIds = locations.map(l => l.id);
  const flags = new Map<string, { in_geofence: boolean | null; signature_url: string | null }>();
  for (let i = 0; i < ids.length; i += 200) { const { data, error } = await supabase.from('visit_personnel').select('id,in_geofence,signature_url').in('id', ids.slice(i, i + 200)); if (error) throw error; for (const r of data ?? []) flags.set(r.id, r); }
  const assignments = locIds.length ? await allRows((a, b) => supabase.from('location_assignments').select('location_id,personnel_id,role_label,assigned_at,unassigned_at').in('location_id', locIds).order('assigned_at').order('id').range(a, b)) : [];
  const crewIds = [...new Set(trail.flatMap(r => r.crew_id ? [r.crew_id] : []))];
  const members = crewIds.length ? await allRows((a, b) => supabase.from('crew_members').select('crew_id,personnel_id,role_label,joined_on,left_on').in('crew_id', crewIds).order('id').range(a, b)) : [];
  const signatures = await allRows((a, b) => supabase.from('document_signatures').select('personnel_id,signed_at,signature_url,project_documents!inner(project_id)').eq('project_documents.project_id', projectId).eq('status', 'signed').gte('signed_at', lower).lt('signed_at', upper).order('signed_at', { ascending: false }).order('id').range(a, b));
  return trail.flatMap(r => {
    if (!r.visit_personnel_id || !r.personnel_id || !r.location_id || !r.in_at) return [];
    const zone = locations.find(l => l.id === r.location_id)?.timezone || 'America/Chicago';
    const day = localDay(r.in_at, zone);
    const role = [...assignments].reverse().find(a => a.personnel_id === r.personnel_id && a.location_id === r.location_id && a.assigned_at <= r.in_at && (!a.unassigned_at || a.unassigned_at > r.in_at));
    const member = members.find(m => m.crew_id === r.crew_id && m.personnel_id === r.personnel_id && m.joined_on <= day && (!m.left_on || m.left_on >= day));
    const flag = flags.get(r.visit_personnel_id);
    const fallback = signatures.find(s => s.personnel_id === r.personnel_id && s.signed_at && localDay(s.signed_at, zone) === day);
    return [{ id: r.visit_personnel_id, personnelId: r.personnel_id, locationId: r.location_id, name: [r.first_name, r.last_name].filter(Boolean).join(' '), position: role?.role_label || member?.role_label || '', inAt: r.in_at, outAt: r.out_at, signature: flag?.signature_url || r.signature_url || fallback?.signature_url || null, offsite: flag?.in_geofence === false }];
  });
}
export async function loadSheetSignature(path: string) {
  // Only known project storage hosts/paths are accepted; arbitrary URLs never receive credentials.
  let url: string;
  if (path.startsWith('http')) {
    const parsed = new URL(path), origin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
    if (parsed.origin !== origin || !parsed.pathname.includes('/storage/v1/object/')) throw new Error('Invalid signature storage URL');
    url = parsed.pathname.includes('/field-captures/') ? path : await signatureImageUrl(path);
  } else url = await signatureImageUrl(path);
  const response = await fetch(url); if (!response.ok) throw new Error('Signature image unavailable'); return response.arrayBuffer();
}