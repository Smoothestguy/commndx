import { useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
export interface AgencyData { people: { personnel_id: string; vendor_id: string }[]; vendors: { id: string; name: string }[]; }
export function useProjectAgencies(projectId: string) {
 const {user}=useAuth();
 const query=useQuery({queryKey:['project-agencies',user?.id,projectId],enabled:!!user&&!!projectId,staleTime:60000,queryFn:async()=>{
  const {data,error}=await supabase.functions.invoke('project-agencies',{body:{project_id:projectId}});
  if(error){if(error instanceof FunctionsHttpError){const detail=await error.context.json().catch(()=>null);throw new Error(detail?.error||error.message);}throw error;}
  return data as AgencyData;
 }});
 const vendorByPerson=Object.fromEntries((query.data?.people||[]).map(p=>[p.personnel_id,p.vendor_id]));
 const vendors=[...(query.data?.vendors||[])].sort((a,b)=>a.name.localeCompare(b.name));
 const names=Object.fromEntries(vendors.map(v=>[v.id,v.name]));
 return {...query,vendorByPerson,vendors,agencyName:(personId:string)=>names[vendorByPerson[personId]]};
}
