import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {FunctionsHttpError} from '@supabase/supabase-js';
import {toast} from 'sonner';
import type {Variance,ClockInput} from '../../supabase/functions/_shared/reconciliation';
export {resolutionMatches,closeBlockers} from '../../supabase/functions/_shared/reconciliation';
export type ReconciliationData={rows:Variance[];entries:ClockInput[];resolutions:{personnel_id:string;var_date:string;kind:string;note:string|null;resolution:string}[];closed:{id:string}|null};
async function action(body:Record<string,unknown>){const {data,error}=await supabase.functions.invoke('reconcile-signin',{body});if(error){const d=error instanceof FunctionsHttpError?await error.context.json().catch(()=>null):null;throw new Error(d?.error||error.message);}return data;}
export function useReconciliation(project:string,week:string,enabled=true){return useQuery<ReconciliationData>({queryKey:['signin-reconciliation',project,week],enabled,queryFn:()=>action({action:'read',project_id:project,week}),refetchInterval:60000});}
export function useReconcileAction(project:string,week:string){const qc=useQueryClient();return useMutation({mutationFn:(body:Record<string,unknown>)=>action({...body,project_id:project,week}),onSuccess:data=>{qc.invalidateQueries({queryKey:['signin-reconciliation',project]});for(const k of ['time-entries','all-time-entries','deployment-hours'])qc.invalidateQueries({queryKey:[k]});toast.success(data.remaining?'Time saved; remaining variances need acknowledgment':'Reconciliation saved');},onError:e=>toast.error(e.message)});}
