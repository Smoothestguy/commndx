import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../client';
import { selectableProjectVendors } from '@/lib/projectVendors';

export function useProjectVendors(projectId?: string) {
  const query = useQuery({ queryKey: ['project-vendors', projectId], enabled: !!projectId, queryFn: async () => {
    if (!projectId) return [];
    const { data, error } = await supabase.rpc('project_vendor_names', { p_project: projectId });
    if (error) throw error;
    return data;
  }});
  return { ...query, all: query.data ?? [], data: selectableProjectVendors(query.data) };
}
export function useSetProjectVendor(projectId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ vendorId, active }: { vendorId: string; active: boolean }) => {
    const { error } = await supabase.from('project_vendors').upsert({ project_id: projectId, vendor_id: vendorId, active }, { onConflict: 'project_id,vendor_id' });
    if (error) throw error;
  }, onSuccess: () => qc.invalidateQueries({ queryKey: ['project-vendors', projectId] }) });
}
export function useLocationProjectId(locationId: string) {
  return useQuery({ queryKey: ['location-project-id', locationId], enabled: !!locationId, queryFn: async () => {
    const { data, error } = await supabase.from('project_locations').select('project_id').eq('id', locationId).single();
    if (error) throw error;
    return data.project_id;
  }});
}