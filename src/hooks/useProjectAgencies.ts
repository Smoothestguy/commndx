import { useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { projectEmployerMaps } from '@/lib/personnelEmployer';
export interface AgencyData { people: { personnel_id: string; vendor_id: string | null; employer_customer_id: string | null; non_billable: boolean }[]; vendors: { id: string; name: string }[]; customers: { id: string; name: string }[]; }
export function useProjectAgencies(projectId: string) {
 const {user}=useAuth();
 const query=useQuery({queryKey:['project-agencies',user?.id,projectId],enabled:!!user&&!!projectId,staleTime:60000,queryFn:async()=>{
  const {data,error}=await supabase.functions.invoke('project-agencies',{body:{project_id:projectId}});
  if(error){if(error instanceof FunctionsHttpError){const detail=await error.context.json().catch(()=>null);throw new Error(detail?.error||error.message);}throw error;}
  return data as AgencyData;
 }});
 return {...query,...projectEmployerMaps(query.data)};
}
