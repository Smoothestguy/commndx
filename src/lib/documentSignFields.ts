import { supabase } from '@/integrations/supabase/client';
import type { SignField } from './documentStamp';

export async function loadDocumentFields(documentId: string): Promise<SignField[]> {
  const { data, error } = await supabase.from('document_sign_fields').select('id,page,x_pct,y_pct,w_pct,h_pct,kind,binding,scope').eq('document_id', documentId).order('page').order('created_at');
  if (error) throw error;
  return data || [];
}

export async function saveDocumentFields(documentId: string, fields: SignField[]) {
  // Upsert first: a failed save must not erase the previous placement. RLS enforces manager writes.
  const previous = await loadDocumentFields(documentId);
  if (fields.length) {
    const { error } = await supabase.from('document_sign_fields').upsert(fields.map(f => ({ ...f, document_id: documentId })), { onConflict: 'id' });
    if (error) throw error;
  }
  const removed = previous.filter(p => !fields.some(f => f.id === p.id)).map(p => p.id);
  if (removed.length) {
    const { error } = await supabase.from('document_sign_fields').delete().eq('document_id', documentId).in('id', removed);
    if (error) throw error;
  }
}