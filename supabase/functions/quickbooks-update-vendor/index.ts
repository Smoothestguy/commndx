import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUICKBOOKS_CLIENT_ID = Deno.env.get("QUICKBOOKS_CLIENT_ID");
const QUICKBOOKS_CLIENT_SECRET = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const QB_API_BASE = "https://quickbooks.api.intuit.com/v3/company";

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
  const url = `${QB_API_BASE}/${realmId}${endpoint}`;

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
    throw new Error(`QuickBooks API error: ${response.status} - ${responseText.substring(0, 500)}`);
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { vendorId } = await req.json();
    console.log("=== QuickBooks Update Vendor ===");
    console.log("Vendor ID:", vendorId);

    if (!vendorId) {
      return new Response(
        JSON.stringify({ error: "vendorId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Check if vendor is mapped to QuickBooks
    const { data: mapping, error: mappingError } = await supabase
      .from("quickbooks_vendor_mappings")
      .select("quickbooks_vendor_id, sync_status")
      .eq("vendor_id", vendorId)
      .maybeSingle();

    if (mappingError) {
      console.error("Mapping fetch error:", mappingError);
      throw new Error("Failed to check QuickBooks mapping");
    }

    if (!mapping) {
      console.log("Vendor not synced to QuickBooks, nothing to update");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Vendor not synced to QuickBooks",
          updated: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qbVendorId = mapping.quickbooks_vendor_id;
    console.log("Found QB vendor mapping:", qbVendorId);

    // Step 2: Fetch current vendor data from local database
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .single();

    if (vendorError || !vendor) {
      throw new Error("Vendor not found");
    }

    console.log("Vendor data:", vendor.name);

    // Step 3: Get valid QB access token
    const { accessToken, realmId } = await getValidToken(supabase);

    // Step 4: Fetch current QB vendor to get SyncToken (conflict prevention)
    console.log("Fetching QB vendor to get SyncToken...");
    const query = `SELECT * FROM Vendor WHERE Id = '${qbVendorId}'`;
    const result = await qbRequest(
      "GET",
      `/query?query=${encodeURIComponent(query)}`,
      accessToken,
      realmId
    );

    const currentQBVendor = result.QueryResponse?.Vendor?.[0];
    if (!currentQBVendor) {
      throw new Error(`QuickBooks vendor not found: ${qbVendorId}`);
    }

    const syncToken = currentQBVendor.SyncToken;
    console.log("Got SyncToken:", syncToken);

    // Step 5: Race condition prevention - update mapping timestamp BEFORE sending to QB
    const preUpdateTimestamp = new Date().toISOString();
    await supabase
      .from("quickbooks_vendor_mappings")
      .update({
        sync_status: "pending",
        last_synced_at: preUpdateTimestamp,
      })
      .eq("vendor_id", vendorId);

    console.log("Pre-update timestamp set:", preUpdateTimestamp);

    // Step 6: Build QB vendor update payload (sparse update)
    const qbVendorData: Record<string, any> = {
      Id: qbVendorId,
      SyncToken: syncToken,
      sparse: true,
      DisplayName: vendor.name,
      CompanyName: vendor.company || vendor.name,
      PrimaryEmailAddr: vendor.email ? { Address: vendor.email } : undefined,
      PrimaryPhone: vendor.phone ? { FreeFormNumber: vendor.phone } : undefined,
      Notes: vendor.specialty || undefined,
      AcctNum: vendor.account_number || vendor.license_number || undefined,
      // Tax and 1099 fields
      TaxIdentifier: vendor.tax_id || undefined,
      Vendor1099: vendor.track_1099 || false,
      // Billing rate
      BillRate: vendor.billing_rate || undefined,
      // Website
      WebAddr: vendor.website ? { URI: vendor.website } : undefined,
    };

    // Add address fields if any address data exists
    if (vendor.address || vendor.city || vendor.state || vendor.zip) {
      qbVendorData.BillAddr = {
        Line1: vendor.address || undefined,
        City: vendor.city || undefined,
        CountrySubDivisionCode: vendor.state || undefined,
        PostalCode: vendor.zip || undefined,
      };
    }

    // Step 7: Send update to QuickBooks
    console.log("Sending vendor update to QuickBooks...");
    const updateResult = await qbRequest("POST", "/vendor", accessToken, realmId, qbVendorData);
    const updatedQBVendor = updateResult.Vendor;

    console.log("Vendor updated in QuickBooks:", updatedQBVendor.Id, updatedQBVendor.DisplayName);

    // Step 8: Update mapping with success status
    const syncedAt = new Date().toISOString();
    await supabase
      .from("quickbooks_vendor_mappings")
      .update({
        sync_status: "synced",
        last_synced_at: syncedAt,
        error_message: null,
      })
      .eq("vendor_id", vendorId);

    // Step 9: Log to quickbooks_sync_log
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "vendor",
      entity_id: vendorId,
      quickbooks_id: qbVendorId,
      action: "update",
      status: "success",
      details: {
        vendorName: vendor.name,
        qbVendorId: updatedQBVendor.Id,
        syncToken: updatedQBVendor.SyncToken,
      },
    });

    console.log("=== Vendor Update Complete ===");

    return new Response(
      JSON.stringify({
        success: true,
        updated: true,
        quickbooksVendorId: updatedQBVendor.Id,
        message: "Vendor synced to QuickBooks successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Vendor update error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Try to update mapping with error status
    try {
      const { vendorId } = await req.clone().json();
      if (vendorId) {
        await supabase
          .from("quickbooks_vendor_mappings")
          .update({
            sync_status: "error",
            error_message: errorMessage,
          })
          .eq("vendor_id", vendorId);

        // Log failure
        await supabase.from("quickbooks_sync_log").insert({
          entity_type: "vendor",
          entity_id: vendorId,
          action: "update",
          status: "error",
          error_message: errorMessage,
        });
      }
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
