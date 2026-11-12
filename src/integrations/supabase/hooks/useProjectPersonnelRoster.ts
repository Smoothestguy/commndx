import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../client';
export function useProjectPersonnelRoster(projectId?: string, enabled = true) {
  return useQuery({ queryKey: ['project-personnel-roster',projectId], enabled: !!projectId && enabled, queryFn: async () => {
    if (!projectId) return [];
    const {data,error} = await supabase.rpc('project_personnel_roster',{p_project:projectId});
    if(error) throw error; return data;
  }});
}
export function useSetProjectPersonnelRoster(projectId: string) {
  const qc=useQueryClient();
  return useMutation({mutationFn:async ({personnelId,active}:{personnelId:string;active:boolean})=>{
    const {data,error}=await supabase.rpc('set_project_personnel_roster',{p_project:projectId,p_person:personnelId,p_active:active});
    if(error)throw error;return data;
  },onSuccess:async()=>{await Promise.all(['project-personnel-roster','personnel-project-assignments','personnel-assignment-counts','personnel-with-assets','project-day-people','attendance-roster','demobe-roster'].map(key=>qc.invalidateQueries({queryKey:[key]})));}});
}