import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AddressValue {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

function extractLocationFromAnswers(answers: Record<string, unknown> | null): {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
} {
  if (!answers) return { address: null, city: null, state: null, zip: null };

  for (const value of Object.values(answers)) {
    if (typeof value === "object" && value !== null && "city" in value) {
      const addr = value as AddressValue;
      return {
        address: addr.street || null,
        city: addr.city || null,
        state: addr.state || null,
        zip: addr.zip || null,
      };
    }
  }
  return { address: null, city: null, state: null, zip: null };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("[Backfill Locations] Starting...");

    // Find applicants with missing city or state
    const { data: applicantsToUpdate, error: fetchError } = await supabase
      .from('applicants')
      .select('id, city, state, address, home_zip')
      .or('city.is.null,state.is.null');

    if (fetchError) {
      console.error("[Backfill Locations] Error fetching applicants:", fetchError);
      throw fetchError;
    }

    console.log(`[Backfill Locations] Found ${applicantsToUpdate?.length || 0} applicants to check`);

    const results = {
      checked: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };

    for (const applicant of applicantsToUpdate || []) {
      results.checked++;

      // Skip if already has city and state
      if (applicant.city && applicant.state) {
        results.skipped++;
        continue;
      }

      // Get the most recent application for this applicant
      const { data: applications, error: appError } = await supabase
        .from('applications')
        .select('answers')
        .eq('applicant_id', applicant.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (appError || !applications || applications.length === 0) {
        console.log(`[Backfill Locations] No application found for applicant ${applicant.id}`);
        results.skipped++;
        continue;
      }

      const answers = applications[0].answers as Record<string, unknown> | null;
      const location = extractLocationFromAnswers(answers);

      // Check if we found any useful location data
      if (!location.city && !location.state) {
        console.log(`[Backfill Locations] No location data in answers for applicant ${applicant.id}`);
        results.skipped++;
        continue;
      }

      // Build update object - only update fields that are currently null
      const updateData: Record<string, string> = {};
      if (!applicant.city && location.city) updateData.city = location.city;
      if (!applicant.state && location.state) updateData.state = location.state;
      if (!applicant.address && location.address) updateData.address = location.address;
      if (!applicant.home_zip && location.zip) updateData.home_zip = location.zip;

      if (Object.keys(updateData).length === 0) {
        results.skipped++;
        continue;
      }

      // Update the applicant
      const { error: updateError } = await supabase
        .from('applicants')
        .update(updateData)
        .eq('id', applicant.id);

      if (updateError) {
        console.error(`[Backfill Locations] Error updating applicant ${applicant.id}:`, updateError);
        results.failed++;
      } else {
        console.log(`[Backfill Locations] Updated applicant ${applicant.id}:`, updateData);
        results.updated++;
      }

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log("[Backfill Locations] Complete:", results);

    return new Response(
      JSON.stringify({
        ok: true,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("[Backfill Locations] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
