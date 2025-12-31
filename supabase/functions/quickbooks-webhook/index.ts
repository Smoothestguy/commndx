import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, intuit-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const QB_CLIENT_ID = Deno.env.get("QUICKBOOKS_CLIENT_ID")!;
const QB_CLIENT_SECRET = Deno.env.get("QUICKBOOKS_CLIENT_SECRET")!;
const WEBHOOK_VERIFIER_TOKEN = Deno.env.get("QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN")!;

interface WebhookPayload {
  eventNotifications: Array<{
    realmId: string;
    dataChangeEvent: {
      entities: Array<{
        name: string;
        id: string;
        operation: "Create" | "Update" | "Delete" | "Merge" | "Void";
        lastUpdated: string;
      }>;
    };
  }>;
}

// Verify the webhook signature from QuickBooks
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(WEBHOOK_VERIFIER_TOKEN),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payload)
    );
    
    const expectedSignature = encode(signatureBuffer);
    return signature === expectedSignature;
  } catch (error) {
    console.error("[Webhook] Signature verification error:", error);
    return false;
  }
}

// Get valid QuickBooks access token
async function getValidToken(supabase: any) {
  const { data: config, error } = await supabase
    .from("quickbooks_config")
    .select("*")
    .single();

  if (error || !config) {
    throw new Error("QuickBooks not connected");
  }

  const now = new Date();
  const tokenExpiry = new Date(config.token_expires_at);

  if (now >= tokenExpiry) {
    console.log("[Webhook] Token expired, refreshing...");
    const refreshResponse = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.refresh_token,
      }),
    });

    if (!refreshResponse.ok) {
      throw new Error("Failed to refresh token");
    }

    const tokens = await refreshResponse.json();
    const newExpiry = new Date(now.getTime() + tokens.expires_in * 1000);

    await supabase
      .from("quickbooks_config")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    return { accessToken: tokens.access_token, realmId: config.realm_id };
  }

  return { accessToken: config.access_token, realmId: config.realm_id };
}

// Fetch estimate from QuickBooks
async function fetchQBEstimate(estimateId: string, accessToken: string, realmId: string) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/estimate/${estimateId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch QB estimate: ${errorText}`);
  }

  const data = await response.json();
  return data.Estimate;
}

// Map QB status to local status
function mapQbStatusToLocal(txnStatus: string | undefined): string {
  switch (txnStatus) {
    case "Accepted":
      return "approved";
    case "Closed":
      return "closed";
    case "Rejected":
      return "rejected";
    case "Pending":
    default:
      return "sent";
  }
}

// Process a single estimate update from QuickBooks
async function processEstimateUpdate(
  supabase: any,
  qbEstimateId: string,
  operation: string,
  accessToken: string,
  realmId: string
) {
  console.log(`[Webhook] Processing estimate ${qbEstimateId}, operation: ${operation}`);

  // Find the local mapping
  const { data: mapping, error: mappingError } = await supabase
    .from("quickbooks_estimate_mappings")
    .select("*, estimates(*)")
    .eq("quickbooks_estimate_id", qbEstimateId)
    .maybeSingle();

  if (mappingError) {
    console.error("[Webhook] Error finding mapping:", mappingError);
    return { success: false, error: mappingError.message };
  }

  if (!mapping) {
    console.log("[Webhook] No local mapping found for QB estimate:", qbEstimateId);
    // This estimate exists in QB but not in Command X - could trigger an import
    return { success: true, skipped: true, reason: "No local mapping" };
  }

  if (operation === "Delete" || operation === "Void") {
    // Mark the local estimate as voided/deleted
    await supabase
      .from("quickbooks_estimate_mappings")
      .update({
        sync_status: "voided",
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", mapping.id);

    console.log("[Webhook] Marked estimate as voided:", mapping.estimate_id);
    return { success: true, action: "voided" };
  }

  // Fetch the full estimate from QuickBooks
  const qbEstimate = await fetchQBEstimate(qbEstimateId, accessToken, realmId);
  console.log("[Webhook] Fetched QB estimate:", qbEstimate.DocNumber);

  // Get QB last updated time
  const qbLastUpdated = new Date(qbEstimate.MetaData.LastUpdatedTime);
  const localLastSynced = mapping.last_synced_at ? new Date(mapping.last_synced_at) : null;

  // Check if QB is actually newer
  if (localLastSynced && qbLastUpdated <= localLastSynced) {
    console.log("[Webhook] QB estimate is not newer than local, skipping");
    return { success: true, skipped: true, reason: "Local is up to date" };
  }

  // Update the local estimate
  const estimateUpdate = {
    notes: qbEstimate.CustomerMemo?.value || null,
    status: mapQbStatusToLocal(qbEstimate.TxnStatus),
    subtotal: parseFloat(qbEstimate.TotalAmt || "0") - parseFloat(qbEstimate.TxnTaxDetail?.TotalTax || "0"),
    tax_amount: parseFloat(qbEstimate.TxnTaxDetail?.TotalTax || "0"),
    total: parseFloat(qbEstimate.TotalAmt || "0"),
    valid_until: qbEstimate.ExpirationDate || mapping.estimates?.valid_until,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("estimates")
    .update(estimateUpdate)
    .eq("id", mapping.estimate_id);

  if (updateError) {
    console.error("[Webhook] Error updating estimate:", updateError);
    return { success: false, error: updateError.message };
  }

  // Update line items - delete existing and insert new
  await supabase
    .from("estimate_line_items")
    .delete()
    .eq("estimate_id", mapping.estimate_id);

  if (qbEstimate.Line && qbEstimate.Line.length > 0) {
    const lineItems = [];
    let sortOrder = 0;

    for (const line of qbEstimate.Line) {
      if (line.DetailType === "SalesItemLineDetail" && line.SalesItemLineDetail) {
        const detail = line.SalesItemLineDetail;
        
        // Try to find matching product by QB item ID
        let productId = null;
        if (detail.ItemRef?.value) {
          const { data: productMapping } = await supabase
            .from("quickbooks_product_mappings")
            .select("product_id")
            .eq("quickbooks_item_id", detail.ItemRef.value)
            .maybeSingle();
          
          if (productMapping) {
            productId = productMapping.product_id;
          }
        }

        lineItems.push({
          estimate_id: mapping.estimate_id,
          product_id: productId,
          product_name: detail.ItemRef?.name || null,
          description: line.Description || detail.ItemRef?.name || "Item",
          quantity: detail.Qty || 1,
          unit_price: parseFloat(detail.UnitPrice || "0"),
          markup: 0,
          total: parseFloat(line.Amount || "0"),
          sort_order: sortOrder++,
          is_taxable: detail.TaxCodeRef?.value === "TAX",
        });
      }
    }

    if (lineItems.length > 0) {
      const { error: lineError } = await supabase
        .from("estimate_line_items")
        .insert(lineItems);

      if (lineError) {
        console.error("[Webhook] Error inserting line items:", lineError);
      }
    }
  }

  // Update the mapping
  await supabase
    .from("quickbooks_estimate_mappings")
    .update({
      last_synced_at: new Date().toISOString(),
      sync_status: "synced",
    })
    .eq("id", mapping.id);

  // Log the sync
  await supabase.from("quickbooks_sync_log").insert({
    entity_type: "estimate",
    entity_id: mapping.estimate_id,
    action: "webhook_update",
    status: "success",
    details: {
      qb_estimate_id: qbEstimateId,
      qb_doc_number: qbEstimate.DocNumber,
      operation,
    },
  });

  console.log("[Webhook] Successfully updated estimate from QB:", mapping.estimate_id);
  return { success: true, action: "updated", estimateId: mapping.estimate_id };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // QuickBooks sends a challenge for webhook verification during setup
  if (req.method === "GET") {
    const url = new URL(req.url);
    const challenge = url.searchParams.get("challenge");
    if (challenge) {
      console.log("[Webhook] Responding to challenge verification");
      return new Response(challenge, {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const payload = await req.text();
    const signature = req.headers.get("intuit-signature");

    console.log("[Webhook] Received webhook, signature present:", !!signature);

    // Verify signature
    if (!signature || !await verifySignature(payload, signature)) {
      console.error("[Webhook] Invalid signature");
      return new Response("Invalid signature", { status: 401, headers: corsHeaders });
    }

    const webhookData: WebhookPayload = JSON.parse(payload);
    console.log("[Webhook] Payload parsed, notifications:", webhookData.eventNotifications?.length);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get valid token for API calls
    const { accessToken, realmId } = await getValidToken(supabase);

    const results = [];

    // Process each notification
    for (const notification of webhookData.eventNotifications || []) {
      // Verify realm ID matches our connected account
      if (notification.realmId !== realmId) {
        console.log("[Webhook] Realm ID mismatch, skipping");
        continue;
      }

      for (const entity of notification.dataChangeEvent?.entities || []) {
        // Currently only handle Estimates
        if (entity.name === "Estimate") {
          const result = await processEstimateUpdate(
            supabase,
            entity.id,
            entity.operation,
            accessToken,
            realmId
          );
          results.push({ entityId: entity.id, ...result });
        } else {
          console.log(`[Webhook] Skipping unsupported entity type: ${entity.name}`);
        }
      }
    }

    console.log("[Webhook] Processing complete, results:", results.length);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // Still return 200 to prevent QuickBooks from retrying
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
