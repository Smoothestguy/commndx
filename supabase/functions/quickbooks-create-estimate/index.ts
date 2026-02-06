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
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`QuickBooks API error: ${errorText}`);
    throw new Error(`QuickBooks API error: ${response.status}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Capture the auth header to forward to downstream functions
    const authHeader = req.headers.get("Authorization");
    
    const { estimateId } = await req.json();
    console.log("Creating QuickBooks estimate for:", estimateId);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if already synced
    const { data: existingMapping } = await supabase
      .from("quickbooks_estimate_mappings")
      .select("*")
      .eq("estimate_id", estimateId)
      .single();

    if (existingMapping) {
      return new Response(
        JSON.stringify({
          success: true,
          quickbooksEstimateId: existingMapping.quickbooks_estimate_id,
          message: "Estimate already synced",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch estimate with line items
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
      'create'
    );

    if (!periodCheck.allowed) {
      console.warn('Locked period violation:', periodCheck.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: periodCheck.message,
          blocked_by: 'locked_period'
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

    const { accessToken, realmId } = await getValidToken(supabase);

    // Get or create customer in QuickBooks - forward auth header via fetch
    const customerSyncResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/quickbooks-sync-customers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({ action: "find-or-create", customerId: estimate.customer_id }),
      }
    );

    if (!customerSyncResponse.ok) {
      const errorText = await customerSyncResponse.text();
      console.error("Customer sync failed:", errorText);
      throw new Error(`Customer sync failed: ${customerSyncResponse.status}`);
    }

    const customerSyncResult = await customerSyncResponse.json();
    const qbCustomerId = customerSyncResult.quickbooksCustomerId;
    if (!qbCustomerId) {
      throw new Error("Failed to get QuickBooks customer ID");
    }

    // Build QuickBooks estimate
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

    console.log("Creating estimate in QuickBooks:", JSON.stringify(qbEstimate, null, 2));

    const result = await qbRequest(
      "POST",
      "/estimate?minorversion=65",
      accessToken,
      realmId,
      qbEstimate
    );

    const qbEstimateId = result.Estimate.Id;
    console.log("QuickBooks estimate created:", qbEstimateId);

    // Create mapping
    await supabase.from("quickbooks_estimate_mappings").insert({
      estimate_id: estimateId,
      quickbooks_estimate_id: qbEstimateId,
      sync_status: "synced",
      last_synced_at: new Date().toISOString(),
    });

    // Log sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "estimate",
      entity_id: estimateId,
      quickbooks_id: qbEstimateId,
      action: "create",
      status: "success",
      details: { number: estimate.number, total: estimate.total },
    });

    return new Response(
      JSON.stringify({
        success: true,
        quickbooksEstimateId: qbEstimateId,
        quickbooksDocNumber: result.Estimate.DocNumber,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating QuickBooks estimate:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
