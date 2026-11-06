import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { parseModuleFlags, moduleVisible, type ModuleFlags, type ModuleKey } from '@/lib/appModules';
import { toast } from 'sonner';
const key=['app-modules'];
export function useAppModules() {
  const {user}=useAuth(),{isAdmin}=useUserRole(),qc=useQueryClient();
  const query=useQuery({queryKey:key,enabled:!!user,staleTime:60000,queryFn:async()=>{
    const {data,error}=await supabase.from('integration_settings').select('setting_value').eq('setting_key','app_modules').maybeSingle();
    if(error)throw error;return parseModuleFlags(data?.setting_value);
  }});
  const update=useMutation({mutationFn:async({module,enabled}:{module:ModuleKey;enabled:boolean})=>{
    if(!isAdmin)throw new Error('Admin access required');
    const {data:row,error:readError}=await supabase.from('integration_settings').select('id,setting_value').eq('setting_key','app_modules').maybeSingle();if(readError)throw readError;
    const flags:ModuleFlags={...parseModuleFlags(row?.setting_value),[module]:enabled};
    const result=row?await supabase.from('integration_settings').update({setting_value:flags}).eq('id',row.id):await supabase.from('integration_settings').insert({setting_key:'app_modules',setting_value:flags});
    if(result.error)throw result.error;return flags;
  },onSuccess:flags=>{qc.setQueryData(key,flags);},onError:e=>toast.error(e.message)});
  return {flags:query.data||{},visible:(path:string)=>moduleVisible(path,query.data||{}),update,isLoading:query.isLoading,error:query.error};
}