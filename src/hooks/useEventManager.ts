import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CampData, EventTable } from '@/lib/eventManager';
import type { Database } from '@/integrations/supabase/types';
async function all<T extends EventTable>(table:T,campId?:string):Promise<Database['public']['Tables'][T]['Row'][]> {
 const rows:Database['public']['Tables'][T]['Row'][]=[];
 for(let offset=0;;offset+=1000){let query=supabase.from(table).select('*').order('id').range(offset,offset+999);if(campId)query=query.eq('event_location_id' as never,campId);const {data,error}=await query;if(error)throw error;rows.push(...(data as unknown as Database['public']['Tables'][T]['Row'][]));if((data?.length??0)<1000)return rows;}
}
export function useEventManager(campId?:string) {
 const client=useQueryClient();
 const camps=useQuery({queryKey:['events','camps'],queryFn:()=>all('event_locations')});
 const detail=useQuery({queryKey:['events','camp',campId],enabled:!!campId,queryFn:async():Promise<CampData>=>{const [companies,people,bunks,assignments,meals,laundry,orders]=await Promise.all([all('event_companies',campId),all('event_company_personnel',campId),all('event_bunks',campId),all('event_bunk_assignments',campId),all('event_meal_scans',campId),all('event_laundry',campId),all('event_task_orders',campId)]);return {companies,people,bunks,assignments,meals,laundry,orders};}});
 async function insert<T extends EventTable>(table:T,values:Database['public']['Tables'][T]['Insert']|Database['public']['Tables'][T]['Insert'][]) {const {error}=await supabase.from(table).insert(values as never);if(error)throw error;await client.invalidateQueries({queryKey:['events']});}
 async function update<T extends EventTable>(table:T,id:string,values:Database['public']['Tables'][T]['Update']) {const {error}=await supabase.from(table).update(values as never).eq('id' as never,id);if(error)throw error;await client.invalidateQueries({queryKey:['events']});}
 return {camps,detail,insert,update};
}
