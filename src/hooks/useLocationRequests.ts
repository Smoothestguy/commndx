import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type RequestKind = 'personnel' | 'asset' | 'other' | 'cancellation';
export type RequestStatus = 'open' | 'accepted' | 'denied' | 'done';
export type LocationRequest = {
  id: string; location_id: string; kind: RequestKind; label: string | null; qty: number; note: string | null;
  status: RequestStatus; created_by: string | null; created_at: string; acted_by: string | null; acted_at: string | null;
};
export const KIND_LABEL: Record<RequestKind, string> = { personnel: 'Personnel', asset: 'Asset', other: 'Other', cancellation: 'Cancellation' };

export function useLocationRequests(locationIds: string[]) {
  const ids = [...locationIds].sort();
  return useQuery({
    queryKey: ['location-requests', ids], enabled: ids.length > 0, refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.from('location_requests').select('*').in('location_id', ids).order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as LocationRequest[];
    },
  });
}

export function useCreateLocationRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: { location_id: string; kind: RequestKind; label: string | null; qty: number; note: string | null }) => {
      const { error } = await supabase.from('location_requests').insert(r);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['location-requests'] }); toast.success('Request raised'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useActOnLocationRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RequestStatus }) => {
      const { error } = await supabase.from('location_requests').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['location-requests'] }); toast.success(`Request ${v.status}`); },
    onError: (e: Error) => toast.error(e.message),
  });
}
