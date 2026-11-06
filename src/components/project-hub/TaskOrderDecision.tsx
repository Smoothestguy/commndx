import {useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {useUserRole} from '@/hooks/useUserRole';
import {useCustomerProjectInvalidation} from '@/hooks/useCustomerProject';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';
import {canManageCustomerPortal} from '@/lib/customerPortal';
export function TaskOrderDecision({order}:{order:{id:string;location_id:string;status:string}}){
 const {role}=useUserRole(),invalidate=useCustomerProjectInvalidation();const [busy,setBusy]=useState(false),[syncPending,setSyncPending]=useState(false);
 if(!canManageCustomerPortal(role)||order.status!=='submitted'&&!syncPending)return null;
 const decide=async(status:'accepted'|'rejected')=>{if(busy)return;setBusy(true);try{if(!syncPending){const {data,error}=await supabase.from('location_task_orders').update({status}).eq('id',order.id).eq('status','submitted').select('id');if(error)throw error;if(!data?.length){await invalidate();throw new Error('This task order was already reviewed. Refresh the list.');}}
   if(status==='accepted'){setSyncPending(true);const {error}=await supabase.rpc('sync_requirements_from_task_orders',{p_location:order.location_id});if(error){await invalidate();throw new Error('Accepted. Requirement sync failed — retry sync below.');}setSyncPending(false);}
   await invalidate();toast.success(status==='accepted'?'Task order accepted; requirements updated':'Task order rejected');
 }catch(e){toast.error(e instanceof Error?e.message:'Decision could not be saved');}finally{setBusy(false);}};
 return <div className="flex gap-2 pt-2"><Button size="sm" disabled={busy} onClick={()=>decide('accepted')}>{syncPending?'Retry requirement sync':busy?'Saving…':'Accept'}</Button>{!syncPending&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>decide('rejected')}>Reject</Button>}</div>;
}