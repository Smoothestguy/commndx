import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuditLog } from '@/hooks/useAuditLog';
export type ProjectType = {id:string;code:string;name:string;color:string;active:boolean};
export function useProjectTypes() { return useQuery({queryKey:['project-types'],queryFn:async()=>{const {data,error}=await supabase.from('project_types').select('*').order('code');if(error)throw error;return data;}}); }
export function useSaveProjectType() {
  const qc=useQueryClient(), {logAction}=useAuditLog();
  return useMutation({mutationFn:async (type:Omit<ProjectType,'id'>&{id?:string})=>{const {id,...values}=type;const result=id?await supabase.from('project_types').update({...values,updated_at:new Date().toISOString()}).eq('id',id).select().single():await supabase.from('project_types').insert(values).select().single();if(result.error)throw result.error;await logAction({actionType:id?'update':'create',resourceType:'project',resourceId:result.data.id,resourceNumber:result.data.code,changesAfter:result.data});return result.data;},onSuccess:()=>{qc.invalidateQueries({queryKey:['project-types']});toast.success('Project type saved');},onError:(e:Error)=>toast.error(e.message)});
}
export function useEventLocationIndex() {return useQuery({queryKey:['event-location-index'],queryFn:async()=>{let out:{id:string;project_id:string;customer_id:string|null;status:string}[]=[];for(let offset=0;;offset+=1000){const {data,error}=await supabase.from('project_locations').select('id,project_id,customer_id,status').order('id').range(offset,offset+999);if(error)throw error;out.push(...data);if(data.length<1000)return out;}}});}