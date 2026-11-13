import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
const shifts=z.object({day_shift_start:z.string().nullable(),day_shift_end:z.string().nullable(),night_shift_start:z.string().nullable(),night_shift_end:z.string().nullable()});
const site=shifts.extend({id:z.string(),project_id:z.string(),name:z.string(),address:z.string().nullable(),city:z.string().nullable(),state:z.string().nullable(),zip:z.string().nullable(),timezone:z.string().nullable(),poc_name:z.string().nullable(),poc_phone:z.string().nullable(),openAt:z.string().nullable(),punchLink:z.string().nullable(),project:shifts.extend({name:z.string()})});
const projection=z.object({linked:z.boolean(),week:z.string(),hours:z.number(),sites:z.array(site),requests:z.array(z.object({id:z.string(),date:z.string(),location:z.string(),link:z.string()}))});
export function useMyDay(enabled=true){
 const {user}=useAuth();
 return useQuery({queryKey:['my-day',user?.id],enabled:enabled&&!!user,refetchInterval:30000,queryFn:async()=>{const {data,error}=await supabase.functions.invoke('my-day',{body:{action:'read'}});if(error||data?.error)throw new Error('My Day could not load');return projection.parse(data);}});
}