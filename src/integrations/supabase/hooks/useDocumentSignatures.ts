import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../client';
import type { Database } from '../types';
import { documentSign } from '@/lib/documentSign';
export type DocumentSignature = Database['public']['Tables']['document_signatures']['Row'] & { name: string };
export function useDocumentSignatures(projectId: string) {
  return useQuery({ queryKey: ['document-signatures', projectId], queryFn: async () => {
    const { data: docs, error: docError } = await supabase.from('project_documents').select('id').eq('project_id', projectId).eq('requires_signature', true);
    if (docError) throw docError;
    if (!docs?.length) return [];
    const { data: rows, error } = await supabase.from('document_signatures').select('*').in('document_id', docs.map(d => d.id)).order('created_at');
    if (error) throw error;
    const ids = [...new Set((rows || []).map(r => r.personnel_id))];
    if (!ids.length) return [];
    const { data: names, error: nameError } = await supabase.from('personnel_directory').select('id,first_name,last_name').in('id', ids);
    if (nameError) throw nameError;
    const map = Object.fromEntries((names || []).map(p => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ')]));
    return (rows || []).map(r => ({ ...r, name: map[r.personnel_id] || 'Personnel' })) as DocumentSignature[];
  }, refetchInterval: 30000 });
}
export function useSendDocumentSignatures(projectId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: { document_id: string; personnel_ids: string[] }) => documentSign<{ results: { personnel_id: string; status: string; reason?: string }[] }>({ action: 'send', ...input }), onSettled: () => qc.invalidateQueries({ queryKey: ['document-signatures', projectId] }) });
}
export function useSignatureRecipients(projectId: string, locationId: string | null, scope: string, search: string, enabled = true) {
  return useQuery({ queryKey: ['signature-recipients', projectId, locationId, scope, search], enabled, queryFn: async () => {
    let ids: string[] | null = null;
    if (scope === 'location' && locationId) {
      const { data, error } = await supabase.from('location_assignments').select('personnel_id').eq('location_id', locationId).eq('status', 'active');
      if (error) throw error; ids = [...new Set((data || []).map(p => p.personnel_id))];
    } else if (scope !== 'all') {
      const { data, error } = await supabase.from('personnel_project_assignments').select('personnel_id').eq('project_id', projectId).eq('status', 'active');
      if (error) throw error; ids = [...new Set((data || []).map(p => p.personnel_id))];
    }
    if (ids && !ids.length) return [];
    let q = supabase.from('personnel_directory').select('id,first_name,last_name').eq('status', 'active').order('first_name').limit(200);
    if (ids) q = q.in('id', ids);
    const safe = search.trim().replace(/[^\p{L}\p{N} -]/gu, '');
    if (safe) q = q.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).flatMap(p => p.id ? [{ id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(' ') }] : []);
  } });
}
