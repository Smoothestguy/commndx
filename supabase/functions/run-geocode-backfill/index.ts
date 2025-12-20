import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeResult {
  ok: boolean;
  lat?: number;
  lng?: number;
  place_name?: string;
  source?: string;
  error?: string;
  reason?: string;
}

async function geocodeAddress(supabaseUrl: string, serviceRoleKey: string, address: string): Promise<GeocodeResult> {
  const response = await fetch(`${supabaseUrl}/functions/v1/geocode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ address }),
  });
  return response.json();
}

function joinAddressParts(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(", ");
}

async function logGeocode(
  supabase: any,
  recordType: 'personnel' | 'applicant',
  recordId: string,
  addressInput: string,
  success: boolean,
  errorMessage: string | null,
  lat: number | null,
  lng: number | null
) {
  try {
    await supabase.from('geocode_logs').insert({
      record_type: recordType,
      record_id: recordId,
      address_input: addressInput,
      success,
      error_message: errorMessage,
      lat,
      lng,
    });
  } catch (e) {
    console.error("[Backfill] Failed to log geocode:", e);
  }
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

    console.log("[Backfill] Starting geocode backfill...");

    const results = {
      personnel: { processed: 0, success: 0, failed: 0, skipped: 0 },
      applicants: { processed: 0, success: 0, failed: 0, skipped: 0 },
    };

    // ===== PERSONNEL BACKFILL =====
    console.log("[Backfill] Processing personnel...");
    
    const { data: personnelWithoutCoords, error: personnelError } = await supabase
      .from('personnel')
      .select('id, address, city, state, zip')
      .or('home_lat.is.null,home_lng.is.null')
      .neq('is_geocodable', false);

    if (personnelError) {
      console.error("[Backfill] Error fetching personnel:", personnelError);
    } else if (personnelWithoutCoords) {
      console.log(`[Backfill] Found ${personnelWithoutCoords.length} personnel to geocode`);
      
      for (const person of personnelWithoutCoords) {
        results.personnel.processed++;
        
        const address = joinAddressParts([
          person.address,
          person.city,
          person.state,
          person.zip,
        ]);

        if (!address.trim()) {
          console.log(`[Backfill] Personnel ${person.id}: No address data, marking as not geocodable`);
          await supabase
            .from('personnel')
            .update({ is_geocodable: false })
            .eq('id', person.id);
          results.personnel.skipped++;
          continue;
        }

        console.log(`[Backfill] Geocoding personnel ${person.id}: ${address}`);
        const geo = await geocodeAddress(supabaseUrl, serviceRoleKey, address);

        if (geo.ok && geo.lat && geo.lng) {
          const { error: updateError } = await supabase
            .from('personnel')
            .update({
              home_lat: geo.lat,
              home_lng: geo.lng,
              geocoded_at: new Date().toISOString(),
              geocode_source: 'mapbox_backfill',
              is_geocodable: true,
            })
            .eq('id', person.id);

          if (updateError) {
            console.error(`[Backfill] Error updating personnel ${person.id}:`, updateError);
            await logGeocode(supabase, 'personnel', person.id, address, false, updateError.message, null, null);
            results.personnel.failed++;
          } else {
            console.log(`[Backfill] Personnel ${person.id}: Updated with coords ${geo.lat}, ${geo.lng}`);
            await logGeocode(supabase, 'personnel', person.id, address, true, null, geo.lat, geo.lng);
            results.personnel.success++;
          }
        } else {
          console.log(`[Backfill] Personnel ${person.id}: No geocode result - ${geo.reason || geo.error}`);
          await logGeocode(supabase, 'personnel', person.id, address, false, geo.reason || geo.error || 'no_match', null, null);
          results.personnel.failed++;
        }

        // Rate limiting - 200ms between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // ===== APPLICANTS BACKFILL =====
    console.log("[Backfill] Processing applicants...");
    
    const { data: applicantsWithoutCoords, error: applicantsError } = await supabase
      .from('applicants')
      .select('id, address, city, state, home_zip')
      .or('home_lat.is.null,home_lng.is.null')
      .neq('is_geocodable', false);

    if (applicantsError) {
      console.error("[Backfill] Error fetching applicants:", applicantsError);
    } else if (applicantsWithoutCoords) {
      console.log(`[Backfill] Found ${applicantsWithoutCoords.length} applicants to geocode`);
      
      for (const applicant of applicantsWithoutCoords) {
        results.applicants.processed++;
        
        // Build address from structured fields or just zip
        const address = joinAddressParts([
          applicant.address,
          applicant.city,
          applicant.state,
          applicant.home_zip,
        ]);

        if (!address.trim()) {
          console.log(`[Backfill] Applicant ${applicant.id}: No address data, marking as not geocodable`);
          await supabase
            .from('applicants')
            .update({ is_geocodable: false })
            .eq('id', applicant.id);
          results.applicants.skipped++;
          continue;
        }

        console.log(`[Backfill] Geocoding applicant ${applicant.id}: ${address}`);
        const geo = await geocodeAddress(supabaseUrl, serviceRoleKey, address);

        if (geo.ok && geo.lat && geo.lng) {
          const { error: updateError } = await supabase
            .from('applicants')
            .update({
              home_lat: geo.lat,
              home_lng: geo.lng,
              geocoded_at: new Date().toISOString(),
              geocode_source: 'mapbox_backfill',
              is_geocodable: true,
            })
            .eq('id', applicant.id);

          if (updateError) {
            console.error(`[Backfill] Error updating applicant ${applicant.id}:`, updateError);
            await logGeocode(supabase, 'applicant', applicant.id, address, false, updateError.message, null, null);
            results.applicants.failed++;
          } else {
            console.log(`[Backfill] Applicant ${applicant.id}: Updated with coords ${geo.lat}, ${geo.lng}`);
            await logGeocode(supabase, 'applicant', applicant.id, address, true, null, geo.lat, geo.lng);
            results.applicants.success++;
          }
        } else {
          console.log(`[Backfill] Applicant ${applicant.id}: No geocode result - ${geo.reason || geo.error}`);
          await logGeocode(supabase, 'applicant', applicant.id, address, false, geo.reason || geo.error || 'no_match', null, null);
          results.applicants.failed++;
        }

        // Rate limiting - 200ms between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log("[Backfill] Completed:", results);

    return new Response(
      JSON.stringify({
        ok: true,
        results,
        summary: {
          totalProcessed: results.personnel.processed + results.applicants.processed,
          totalSuccess: results.personnel.success + results.applicants.success,
          totalFailed: results.personnel.failed + results.applicants.failed,
          totalSkipped: results.personnel.skipped + results.applicants.skipped,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("[Backfill] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
