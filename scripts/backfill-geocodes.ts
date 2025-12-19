/**
 * Backfill Geocodes Script
 * 
 * Run this script to geocode existing personnel and applicants that don't have coordinates.
 * 
 * Usage:
 *   SUPABASE_URL=https://your-project.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
 *   npx ts-node scripts/backfill-geocodes.ts
 * 
 * Or via Deno:
 *   deno run --allow-net --allow-env scripts/backfill-geocodes.ts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://xfjjvznxkcckuwxmcsdc.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface GeocodeResult {
  ok: boolean;
  lat?: number;
  lng?: number;
  source?: string;
  reason?: string;
  error?: string;
}

async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const { data, error } = await supabase.functions.invoke("geocode", {
    body: { address },
  });
  
  if (error) {
    console.error("Geocode function error:", error);
    return { ok: false, error: error.message };
  }
  
  return data as GeocodeResult;
}

function joinAddressParts(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(", ").trim();
}

async function backfillPersonnel() {
  console.log("\n=== Backfilling Personnel ===\n");
  
  const { data: rows, error } = await supabase
    .from("personnel")
    .select("id, first_name, last_name, home_lat, home_lng, address, city, state, zip")
    .is("home_lat", null);

  if (error) {
    console.error("Error fetching personnel:", error);
    return;
  }

  console.log(`Found ${rows?.length ?? 0} personnel without coordinates`);

  for (const person of rows ?? []) {
    const address = joinAddressParts([person.address, person.city, person.state, person.zip]);

    if (!address) {
      console.log(`⏭️  ${person.first_name} ${person.last_name}: No address data, skipping`);
      continue;
    }

    console.log(`🔍 Geocoding ${person.first_name} ${person.last_name}: ${address}`);
    
    const geo = await geocodeAddress(address);
    
    if (!geo.ok) {
      console.log(`❌ Failed: ${geo.reason || geo.error}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("personnel")
      .update({
        home_lat: geo.lat,
        home_lng: geo.lng,
      })
      .eq("id", person.id);

    if (updateError) {
      console.error(`❌ Update error:`, updateError);
    } else {
      console.log(`✅ Updated: ${geo.lat}, ${geo.lng}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

async function backfillApplicants() {
  console.log("\n=== Backfilling Applicants ===\n");
  
  const { data: rows, error } = await supabase
    .from("applicants")
    .select("id, first_name, last_name, home_lat, home_lng, home_zip")
    .is("home_lat", null);

  if (error) {
    console.error("Error fetching applicants:", error);
    return;
  }

  console.log(`Found ${rows?.length ?? 0} applicants without coordinates`);

  for (const applicant of rows ?? []) {
    // Applicants typically only have home_zip, but we try to geocode it
    const address = applicant.home_zip || "";

    if (!address) {
      console.log(`⏭️  ${applicant.first_name} ${applicant.last_name}: No zip code, skipping`);
      continue;
    }

    console.log(`🔍 Geocoding ${applicant.first_name} ${applicant.last_name}: ${address}`);
    
    const geo = await geocodeAddress(address);
    
    if (!geo.ok) {
      console.log(`❌ Failed: ${geo.reason || geo.error}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("applicants")
      .update({
        home_lat: geo.lat,
        home_lng: geo.lng,
      })
      .eq("id", applicant.id);

    if (updateError) {
      console.error(`❌ Update error:`, updateError);
    } else {
      console.log(`✅ Updated: ${geo.lat}, ${geo.lng}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

// Main execution
console.log("🚀 Starting geocode backfill...");
console.log(`📍 Supabase URL: ${SUPABASE_URL}`);

await backfillPersonnel();
await backfillApplicants();

console.log("\n✨ Backfill complete!");
