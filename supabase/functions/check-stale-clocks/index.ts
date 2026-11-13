import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {authorize,service,json} from '../_shared/signinJobs.ts';
import {scheduledClose} from '../_shared/scheduledClose.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const db=service();
  const auth=await authorize(req,db,true);
  if(!auth)return json({error:'Unauthorized'},403);
  return json(await scheduledClose(db,false));
});
