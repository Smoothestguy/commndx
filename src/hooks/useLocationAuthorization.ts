import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { localDay } from '@/lib/signinSheets';
import { authorizedTotal, authorizationGap, type AuthorizationLevel } from '@/lib/locationAuthorization';
async function allAuthorizationRows<T>(make:(offset:number)=>PromiseLike<{data:T[]|null;error:unknown}>) {
  const out:T[]=[];for(let offset=0;;offset+=500){const {data,error}=await make(offset);if(error)throw error;out.push(...data??[]);if((data??[]).length<500)return out;}
}
export async function loadLocationAuthorization(locationId: string, date: string) {
  const { data: orders, error } = await supabase.from('location_task_orders').select('id').eq('location_id', locationId).eq('status', 'accepted').lte('effective_date', date).limit(1);
  if (error) throw error;
  if (!orders?.length) return null;
  const { data, error: rpcError } = await supabase.rpc('location_authorized_asof', { p_location: locationId, p_date: date });
  if (rpcError) throw rpcError;
  return data ?? [];
}
export function useLocationAuthorization(locations: { id: string; timezone?: string | null }[], date?: string) {
  const dates = locations.map(l => [l.id, date || localDay(new Date().toISOString(), l.timezone || 'America/Chicago')]).sort((a,b) => a[0].localeCompare(b[0]));
  return useQuery({ queryKey: ['location-authorization', dates], enabled: dates.length > 0, refetchInterval: 60000, queryFn: async () => {
    const ids = dates.map(d => d[0]);
    const out: Record<string, { levels: AuthorizationLevel[]; positions: number; assets: number; actual: number; actualAssets: number; under: number; over: number; assetUnder: number; assetOver: number }> = {};
    const orders=await allAuthorizationRows(o=>supabase.from('location_task_orders').select('location_id,effective_date').in('location_id',ids).eq('status','accepted').order('id').range(o,o+499));
    const managed=dates.filter(([id,day])=>orders.some(o=>o.location_id===id&&o.effective_date<=day));
    if(!managed.length)return out;
    const managedIds=managed.map(d=>d[0]);
    const [people,assets]=await Promise.all([
      allAuthorizationRows(o=>supabase.from('location_assignments').select('location_id,role_label').in('location_id',managedIds).eq('status','active').is('unassigned_at',null).order('id').range(o,o+499)),
      allAuthorizationRows(o=>supabase.from('asset_assignments').select('location_id').in('location_id',managedIds).eq('status','active').is('unassigned_at',null).is('end_at',null).order('id').range(o,o+499)),
    ]);
    await Promise.all(dates.map(async ([id, day]) => {
      if (!orders.some(o => o.location_id === id && o.effective_date <= day)) return;
      const {data,error} = await supabase.rpc('location_authorized_asof',{p_location:id,p_date:day}); if(error) throw error;
      const levels=data??[], positions=authorizedTotal(levels,'position'), assetTotal=authorizedTotal(levels,'asset');
      const actual=people.filter(p=>p.location_id===id).length, actualAssets=assets.filter(a=>a.location_id===id).length;
      const gap=authorizationGap(actual,positions), ag=authorizationGap(actualAssets,assetTotal);
      out[id]={levels,positions,assets:assetTotal,actual,actualAssets,...gap,assetUnder:ag.under,assetOver:ag.over};
    })); return out;
  }});
}