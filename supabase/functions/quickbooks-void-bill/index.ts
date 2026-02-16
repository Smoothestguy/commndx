import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const QUICKBOOKS_CLIENT_ID = Deno.env.get("QUICKBOOKS_CLIENT_ID");
const QUICKBOOKS_CLIENT_SECRET = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");

// Authentication helper - validates user and checks admin/manager role
async function authenticateRequest(req: Request): Promise<{ userId: string; error?: never } | { userId?: never; error: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("[void-bill] No authorization header provided");
    return {
      error: new Response(JSON.stringify({ success: false, error: "Unauthorized - no auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    console.error("[void-bill] Auth claims failed:", claimsError);
    return {
      error: new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    };
  }

  const userId = claimsData.claims.sub as string;

  // Check user role
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  const role = roleData?.role;
  if (role !== "admin" && role !== "manager") {
    console.error("[void-bill] Insufficient role:", role);
    return {
      error: new Response(JSON.stringify({ success: false, error: "Forbidden - admin/manager required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    };
  }

  return { userId };
}

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
    console.log("[void-bill] Refreshing QuickBooks token...");
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

  console.log(`[void-bill] QB API ${method} ${endpoint}`);
  const response = await fetch(url, options);

  let responseText: string;
  try {
    responseText = await response.text();
  } catch (textError) {
    console.error("[void-bill] Failed to read response body:", textError);
    throw new Error(`QuickBooks API response read error: ${textError}`);
  }

  if (!response.ok) {
    console.error(`[void-bill] QuickBooks API error response: ${responseText}`);
    throw new Error(`QuickBooks API error: ${response.status} - ${responseText.substring(0, 200)}`);
  }

  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    console.error("[void-bill] Failed to parse QB response as JSON:", responseText.substring(0, 500));
    throw new Error(`QuickBooks API returned invalid JSON: ${parseError}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate request
    const authResult = await authenticateRequest(req);
    if ("error" in authResult) {
      return authResult.error;
    }
    console.log("[void-bill] Authenticated user:", authResult.userId);

    const { billId } = await req.json();
    console.log("[void-bill] Voiding/deleting QuickBooks bill for local bill:", billId);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if bill is mapped to QuickBooks
    const { data: mapping, error: mappingError } = await supabase
      .from("quickbooks_bill_mappings")
      .select("quickbooks_bill_id, sync_status")
      .eq("bill_id", billId)
      .maybeSingle();

    if (mappingError) {
      console.error("[void-bill] Mapping fetch error:", mappingError);
      throw new Error("Failed to check QuickBooks mapping");
    }

    if (!mapping) {
      console.log("[void-bill] Bill not synced to QuickBooks, nothing to void");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Bill not synced to QuickBooks",
          voided: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if already voided
    if (mapping.sync_status === "voided") {
      console.log("[void-bill] Bill already voided in QuickBooks");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Bill already voided in QuickBooks",
          voided: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qbBillId = mapping.quickbooks_bill_id;
    
    // Check for empty/invalid QB bill ID
    if (!qbBillId || qbBillId === '') {
      console.log("[void-bill] No valid QuickBooks bill ID found in mapping, marking as voided");
      await supabase
        .from("quickbooks_bill_mappings")
        .update({
          sync_status: "voided",
          updated_at: new Date().toISOString(),
        })
        .eq("bill_id", billId);
      
      return new Response(
        JSON.stringify({
          success: true,
          message: "Bill mapping cleaned up",
          voided: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[void-bill] Found QB bill mapping:", qbBillId);

    // Get valid token
    const { accessToken, realmId } = await getValidToken(supabase);

    // Fetch the current QB bill to get SyncToken
    console.log("[void-bill] Fetching QB bill to get SyncToken...");
    const qbBillData = await qbRequest(
      "GET",
      `/bill/${qbBillId}`,
      accessToken,
      realmId
    );

    const syncToken = qbBillData.Bill.SyncToken;
    console.log("[void-bill] Got SyncToken:", syncToken);

    // Delete the bill in QuickBooks
    console.log("[void-bill] Deleting bill in QuickBooks...");
    
    const deletePayload = {
      Id: qbBillId,
      SyncToken: syncToken,
    };

    await qbRequest(
      "POST",
      "/bill?operation=delete&minorversion=65",
      accessToken,
      realmId,
      deletePayload
    );

    console.log("[void-bill] Bill deleted successfully in QuickBooks");

    // Update mapping to reflect voided/deleted status
    await supabase
      .from("quickbooks_bill_mappings")
      .update({
        sync_status: "voided",
        updated_at: new Date().toISOString(),
      })
      .eq("bill_id", billId);

    // Log successful void/delete
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "vendor_bill",
      entity_id: billId,
      quickbooks_id: qbBillId,
      action: "delete",
      status: "success",
      details: { message: "Bill deleted in QuickBooks" },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Bill deleted in QuickBooks",
        quickbooksBillId: qbBillId,
        voided: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[void-bill] QuickBooks bill void/delete error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({ success: false, error: errorMessage, voided: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
