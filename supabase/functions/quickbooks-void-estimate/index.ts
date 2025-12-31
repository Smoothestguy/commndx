import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const QUICKBOOKS_CLIENT_ID = Deno.env.get("QUICKBOOKS_CLIENT_ID");
const QUICKBOOKS_CLIENT_SECRET = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");

async function getValidToken(supabase: any) {
  const { data: config, error } = await supabase
    .from("quickbooks_config")
    .select("*")
    .eq("is_connected", true)
    .single();

  if (error || !config) {
    throw new Error("QuickBooks not connected");
  }

  const tokenExpires = new Date(config.token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (tokenExpires < fiveMinutesFromNow) {
    console.log("Refreshing QuickBooks token...");
    const tokenResponse = await fetch(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=refresh_token&refresh_token=${config.refresh_token}`,
      }
    );

    if (!tokenResponse.ok) {
      throw new Error("Failed to refresh token");
    }

    const tokens = await tokenResponse.json();

    await supabase
      .from("quickbooks_config")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    return { accessToken: tokens.access_token, realmId: config.realm_id };
  }

  return { accessToken: config.access_token, realmId: config.realm_id };
}

async function qbRequest(
  method: string,
  endpoint: string,
  accessToken: string,
  realmId: string,
  body?: any
) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "identity",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "CommandX/1.0",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`QB API ${method} ${endpoint}`);
  const response = await fetch(url, options);

  let responseText: string;
  try {
    responseText = await response.text();
  } catch (textError) {
    console.error("Failed to read response body:", textError);
    throw new Error(`QuickBooks API response read error: ${textError}`);
  }

  if (!response.ok) {
    console.error(`QuickBooks API error response: ${responseText}`);
    throw new Error(`QuickBooks API error: ${response.status} - ${responseText.substring(0, 200)}`);
  }

  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    console.error("Failed to parse QB response as JSON:", responseText.substring(0, 500));
    throw new Error(`QuickBooks API returned invalid JSON: ${parseError}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { estimateId } = await req.json();
    console.log("Voiding QuickBooks estimate for local estimate:", estimateId);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if estimate is mapped to QuickBooks
    const { data: mapping, error: mappingError } = await supabase
      .from("quickbooks_estimate_mappings")
      .select("quickbooks_estimate_id, sync_status")
      .eq("estimate_id", estimateId)
      .maybeSingle();

    if (mappingError) {
      console.error("Mapping fetch error:", mappingError);
      throw new Error("Failed to check QuickBooks mapping");
    }

    if (!mapping) {
      console.log("Estimate not synced to QuickBooks, nothing to void");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Estimate not synced to QuickBooks",
          voided: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if already voided
    if (mapping.sync_status === "voided") {
      console.log("Estimate already voided in QuickBooks");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Estimate already voided in QuickBooks",
          voided: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qbEstimateId = mapping.quickbooks_estimate_id;
    console.log("Found QB estimate mapping:", qbEstimateId);

    // Get valid token
    const { accessToken, realmId } = await getValidToken(supabase);

    // Fetch the current QB estimate to get SyncToken
    console.log("Fetching QB estimate to get SyncToken...");
    const qbEstimateData = await qbRequest(
      "GET",
      `/estimate/${qbEstimateId}`,
      accessToken,
      realmId
    );

    const syncToken = qbEstimateData.Estimate.SyncToken;
    console.log("Got SyncToken:", syncToken);

    // Void the estimate in QuickBooks
    // Note: QuickBooks estimates use DELETE operation rather than void
    // We'll update to Closed status instead since estimates can't be voided like invoices
    console.log("Closing/voiding estimate in QuickBooks...");
    
    const updatePayload = {
      Id: qbEstimateId,
      SyncToken: syncToken,
      TxnStatus: "Closed",
    };

    const result = await qbRequest(
      "POST",
      "/estimate?minorversion=65",
      accessToken,
      realmId,
      updatePayload
    );

    console.log("Estimate closed/voided successfully:", result.Estimate?.Id);

    // Update mapping to reflect voided status
    await supabase
      .from("quickbooks_estimate_mappings")
      .update({
        sync_status: "voided",
        updated_at: new Date().toISOString(),
      })
      .eq("estimate_id", estimateId);

    // Log successful void
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "estimate",
      entity_id: estimateId,
      quickbooks_id: qbEstimateId,
      action: "void",
      status: "success",
      details: { message: "Estimate closed in QuickBooks" },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Estimate voided in QuickBooks",
        quickbooksEstimateId: qbEstimateId,
        voided: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("QuickBooks estimate void error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({ success: false, error: errorMessage, voided: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
