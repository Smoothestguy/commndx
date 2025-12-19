import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();
    
    if (!address || typeof address !== "string") {
      console.error("[Geocode] Missing or invalid address");
      return new Response(
        JSON.stringify({ ok: false, error: "address_required" }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("[Geocode] Geocoding address:", address);

    const token = Deno.env.get("MapBox");
    if (!token) {
      console.error("[Geocode] MapBox token not configured");
      return new Response(
        JSON.stringify({ ok: false, error: "missing_mapbox_token" }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error("[Geocode] Mapbox API error:", res.status, res.statusText);
      return new Response(
        JSON.stringify({ ok: false, error: "geocode_failed" }), 
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await res.json();
    const feature = data?.features?.[0];

    if (!feature?.center?.length) {
      console.log("[Geocode] No match found for address:", address);
      return new Response(
        JSON.stringify({ ok: false, reason: "no_match" }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [lng, lat] = feature.center;
    console.log("[Geocode] Successfully geocoded:", { lat, lng, placeName: feature.place_name });

    return new Response(
      JSON.stringify({
        ok: true,
        lat,
        lng,
        place_name: feature.place_name,
        source: "mapbox_geocode",
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("[Geocode] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "bad_request", details: String(error) }), 
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
