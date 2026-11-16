import {useQueries} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useUserRole} from '@/hooks/useUserRole';
import {billableSignedHeadcount} from '@/lib/locationPerDiem';
import type {BillingSource} from '@/lib/toBilling';
/** Reuse the manager-authorized billing source; never query financial data for field users. */
export function useLocationPerDiemCounts(ids:string[]){
 const {isAdmin,isManager}=useUserRole();
 const queries=useQueries({queries:[...new Set(ids)].map(id=>({queryKey:['to-engine-panel',id],enabled:isAdmin||isManager,staleTime:60000,queryFn:async()=>{const r=await supabase.rpc('location_to_billing_sources',{p_location:id});if(r.error)throw r.error;return r.data as unknown as BillingSource;}}))});
 return Object.fromEntries([...new Set(ids)].map((id,i)=>[id,queries[i]?.data?billableSignedHeadcount(queries[i].data.stays):undefined]));
}