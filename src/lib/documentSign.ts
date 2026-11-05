import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
export async function documentSign<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('document-sign', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detail = await error.context.json().catch(() => null);
      throw new Error(detail?.error || error.message);
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
export const signatureTime = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) + ' CT';
