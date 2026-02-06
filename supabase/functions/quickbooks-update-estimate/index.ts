import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateLockedPeriod } from "../_shared/lockedPeriodValidator.ts";

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

  const tokenExpiry = new Date(config.token_expires_at);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  if (tokenExpiry.getTime() - now.getTime() < fiveMinutes) {
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
    console.log("Updating QuickBooks estimate for:", estimateId);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if estimate is synced to QuickBooks
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
      console.log("Estimate not synced to QuickBooks, nothing to update");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Estimate not synced to QuickBooks",
          updated: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if voided
    if (mapping.sync_status === "voided") {
      console.log("Estimate already voided in QuickBooks, skipping update");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Estimate already voided in QuickBooks",
          updated: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qbEstimateId = mapping.quickbooks_estimate_id;
    console.log("Found QB estimate mapping:", qbEstimateId);

    // Fetch estimate with line items from local DB
    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("*")
      .eq("id", estimateId)
      .single();

    if (estimateError || !estimate) {
      throw new Error("Estimate not found");
    }

    // Validate locked period BEFORE syncing to QuickBooks
    const periodCheck = await validateLockedPeriod(
      supabase,
      estimate.date || estimate.created_at?.split('T')[0],
      'estimate',
      estimateId,
      "system",
      'update'
    );

    if (!periodCheck.allowed) {
      console.warn('Locked period violation:', periodCheck.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: periodCheck.message,
          blocked_by: 'locked_period',
          updated: false
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: lineItems, error: lineItemsError } = await supabase
      .from("estimate_line_items")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: true });

    if (lineItemsError) {
      throw lineItemsError;
    }

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

    // Get or create customer in QuickBooks
    const { data: customerSyncResult, error: customerError } = await supabase.functions.invoke(
      "quickbooks-sync-customers",
      {
        body: { action: "find-or-create", customerId: estimate.customer_id },
      }
    );

    if (customerError) {
      throw new Error(`Customer sync failed: ${customerError.message}`);
    }

    const qbCustomerId = customerSyncResult.quickbooksCustomerId;
    if (!qbCustomerId) {
      throw new Error("Failed to get QuickBooks customer ID");
    }

    // Build updated QuickBooks estimate
    const qbLineItems = lineItems.map((item: any, index: number) => ({
      LineNum: index + 1,
      Amount: item.total,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        Qty: item.quantity,
        UnitPrice: item.unit_price * (1 + (item.markup || 0) / 100),
      },
      Description: item.description,
    }));

    const qbEstimate: any = {
      Id: qbEstimateId,
      SyncToken: syncToken,
      CustomerRef: { value: qbCustomerId },
      DocNumber: estimate.number,
      TxnDate: estimate.created_at.split("T")[0],
      ExpirationDate: estimate.valid_until,
      Line: qbLineItems,
      CustomerMemo: { value: estimate.notes || "" },
    };

    // Add tax if applicable
    if (estimate.tax_rate > 0) {
      qbEstimate.TxnTaxDetail = {
        TotalTax: estimate.tax_amount,
      };
    }

    console.log("Updating estimate in QuickBooks:", JSON.stringify(qbEstimate, null, 2));

    const result = await qbRequest(
      "POST",
      "/estimate?minorversion=65",
      accessToken,
      realmId,
      qbEstimate
    );

    console.log("QuickBooks estimate updated:", result.Estimate.Id);

    // Update mapping timestamp
    await supabase
      .from("quickbooks_estimate_mappings")
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: "synced",
        updated_at: new Date().toISOString(),
      })
      .eq("estimate_id", estimateId);

    // Log sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "estimate",
      entity_id: estimateId,
      quickbooks_id: qbEstimateId,
      action: "update",
      status: "success",
      details: { number: estimate.number, total: estimate.total },
    });

    return new Response(
      JSON.stringify({
        success: true,
        quickbooksEstimateId: qbEstimateId,
        message: "Estimate updated in QuickBooks",
        updated: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating QuickBooks estimate:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: errorMessage, updated: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
