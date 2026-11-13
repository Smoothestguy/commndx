import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import {scopeLocationReviews} from '@/lib/locationReviewScope';
export function useShiftReviews(projectId: string, locationIds: string[]) {
 const {isAdmin,isManager}=useUserRole();const ids=[...locationIds].sort();
 return useQuery({queryKey:['shift-reviews',projectId,ids],enabled:(isAdmin||isManager)&&ids.length>0,refetchInterval:60_000,queryFn:async()=>{
   const early:any[]=[],extensions:any[]=[];
   for(let offset=0;;offset+=500){const {data,error}=await scopeLocationReviews(supabase.from('personnel_location_trail').select('visit_personnel_id,personnel_id,first_name,last_name,location_id,in_at,actual_in_at'),projectId,ids).order('visit_personnel_id').range(offset,offset+499);if(error)throw error;const rows=data||[];for(let i=0;i<rows.length;i+=200){const part=rows.slice(i,i+200);const {data:flags,error:fe}=await supabase.from('visit_personnel').select('id,early_in_reason,offsite_approved_by,offsite_approved_at').in('id',part.map(r=>r.visit_personnel_id||'')).not('early_in_reason','is',null).is('offsite_approved_at',null);if(fe)throw fe;for(const f of flags||[]){const r=part.find(r=>r.visit_personnel_id===f.id);if(r)early.push({...r,...f});}}if(rows.length<500)break;}
   for(let offset=0;;offset+=500){const {data,error}=await supabase.from('shift_extensions').select('id,personnel_id,location_id,reason,until_at,requested_at,ext_date,status').in('location_id',ids).eq('status','pending').order('requested_at').range(offset,offset+499);if(error)throw error;extensions.push(...(data||[]));if((data||[]).length<500)break;}
   const pids=[...new Set<string>(extensions.map(r=>r.personnel_id))];const names:Record<string,string>={};for(let i=0;i<pids.length;i+=200){const {data,error}=await supabase.from('personnel_directory').select('id,first_name,last_name').in('id',pids.slice(i,i+200));if(error)throw error;for(const p of data||[])if(p.id)names[p.id]=[p.first_name,p.last_name].filter(Boolean).join(' ');}
   return {early,extensions:extensions.map(r=>({...r,name:names[r.personnel_id]||'Person'}))};
 }});
}
export function useReviewShift() {
 const qc=useQueryClient();return useMutation({mutationFn:async(v:{id:string;kind:'early'|'extension';status:'approved'|'denied'})=>{const {data,error}=await supabase.functions.invoke('shift-discipline',{body:{action:'review',...v}});if(error||!data?.ok)throw new Error(data?.error||'Review not saved. Refresh and try again.');},onSuccess:()=>{for(const key of ['shift-reviews','today-visits','visits-window','trail-review-flags','deployment-alerts','week-timesheet','personnel-trail','time-entries','all-time-entries','deployment-hours','location-attendance','location-attendance-batch','signin-sheet-stays','signin-reconciliation'])void qc.invalidateQueries({queryKey:[key]});toast.success('Review saved');},onError:e=>toast.error(e.message)});
}