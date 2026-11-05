import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export function useAgencyNames() {
  return useQuery({queryKey:['agency-labels'],staleTime:300000,queryFn:async()=>{const {data,error}=await supabase.from('vendors').select('id,name');if(error)throw error;return new Map(data.map(v=>[v.id,v.name]));}});
}