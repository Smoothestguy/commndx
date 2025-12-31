import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUICKBOOKS_API_BASE = "https://quickbooks.api.intuit.com/v3/company";

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
    const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID");
    const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");

    const tokenResponse = await fetch(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
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

async function qbQuery(query: string, accessToken: string, realmId: string) {
  const url = `${QUICKBOOKS_API_BASE}/${realmId}/query?query=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("QuickBooks query error:", errorText);
    throw new Error(`QuickBooks API error: ${response.status}`);
  }

  return response.json();
}

function mapQbStatusToLocal(txnStatus: string): string {
  switch (txnStatus?.toLowerCase()) {
    case "accepted":
    case "closed":
      return "approved";
    case "rejected":
      return "draft";
    case "pending":
    default:
      return "pending";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting QuickBooks estimate import...");

    const { accessToken, realmId } = await getValidToken(supabase);

    // Query all estimates from QuickBooks
    const query = "SELECT * FROM Estimate ORDERBY MetaData.CreateTime DESC MAXRESULTS 500";
    const result = await qbQuery(query, accessToken, realmId);

    const qbEstimates = result.QueryResponse?.Estimate || [];
    console.log(`Found ${qbEstimates.length} estimates in QuickBooks`);

    // Get existing mappings to know which are already imported
    const { data: existingMappings } = await supabase
      .from("quickbooks_estimate_mappings")
      .select("quickbooks_estimate_id, estimate_id");

    const mappedQbIds = new Set(existingMappings?.map((m: any) => m.quickbooks_estimate_id) || []);

    // Get customer mappings for matching
    const { data: customerMappings } = await supabase
      .from("quickbooks_customer_mappings")
      .select("customer_id, quickbooks_customer_id");

    const qbCustomerToLocal = new Map(
      customerMappings?.map((m: any) => [m.quickbooks_customer_id, m.customer_id]) || []
    );

    // Get product mappings for matching line items
    const { data: productMappings } = await supabase
      .from("quickbooks_product_mappings")
      .select("product_id, quickbooks_item_id");

    const qbProductToLocal = new Map(
      productMappings?.map((m: any) => [m.quickbooks_item_id, m.product_id]) || []
    );

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
      unmappedCustomers: [] as string[],
    };

    for (const qbEstimate of qbEstimates) {
      const qbEstimateId = qbEstimate.Id;

      // Skip if already imported
      if (mappedQbIds.has(qbEstimateId)) {
        results.skipped++;
        continue;
      }

      try {
        // Find local customer
        const qbCustomerId = qbEstimate.CustomerRef?.value;
        const localCustomerId = qbCustomerToLocal.get(qbCustomerId);

        if (!localCustomerId) {
          const customerName = qbEstimate.CustomerRef?.name || "Unknown";
          if (!results.unmappedCustomers.includes(customerName)) {
            results.unmappedCustomers.push(customerName);
          }
          results.errors.push(`Estimate ${qbEstimate.DocNumber}: Customer "${customerName}" not mapped`);
          continue;
        }

        // Get customer info
        const { data: customer } = await supabase
          .from("customers")
          .select("name")
          .eq("id", localCustomerId)
          .single();

        // Calculate totals from line items
        let subtotal = 0;
        const lineItems: any[] = [];

        for (const line of qbEstimate.Line || []) {
          if (line.DetailType === "SalesItemLineDetail" && line.SalesItemLineDetail) {
            const detail = line.SalesItemLineDetail;
            const qty = detail.Qty || 1;
            const unitPrice = detail.UnitPrice || 0;
            const lineTotal = line.Amount || (qty * unitPrice);

            subtotal += lineTotal;

            lineItems.push({
              description: line.Description || "Imported item",
              quantity: qty,
              unit_price: unitPrice,
              markup: 0,
              total: lineTotal,
              is_taxable: detail.TaxCodeRef?.value !== "NON",
              product_id: qbProductToLocal.get(detail.ItemRef?.value) || null,
              product_name: detail.ItemRef?.name || null,
            });
          } else if (line.DetailType === "SubTotalLineDetail") {
            // Skip subtotal lines
            continue;
          }
        }

        const taxAmount = qbEstimate.TxnTaxDetail?.TotalTax || 0;
        const total = qbEstimate.TotalAmt || (subtotal + taxAmount);
        const taxRate = subtotal > 0 ? (taxAmount / subtotal) * 100 : 0;

        // Create estimate in Command X with the QB DocNumber
        const estimateData = {
          number: qbEstimate.DocNumber || `QB-${qbEstimateId}`,
          customer_id: localCustomerId,
          customer_name: customer?.name || "Unknown Customer",
          status: mapQbStatusToLocal(qbEstimate.TxnStatus),
          subtotal,
          tax_rate: Math.round(taxRate * 100) / 100,
          tax_amount: taxAmount,
          total,
          valid_until: qbEstimate.ExpirationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          notes: qbEstimate.CustomerMemo?.value || null,
          jobsite_address: qbEstimate.ShipAddr 
            ? `${qbEstimate.ShipAddr.Line1 || ""} ${qbEstimate.ShipAddr.City || ""} ${qbEstimate.ShipAddr.CountrySubDivisionCode || ""} ${qbEstimate.ShipAddr.PostalCode || ""}`.trim()
            : null,
        };

        // Check if estimate number already exists
        const { data: existingEstimate } = await supabase
          .from("estimates")
          .select("id")
          .eq("number", estimateData.number)
          .maybeSingle();

        let estimateId: string;

        if (existingEstimate) {
          // Update existing estimate
          estimateId = existingEstimate.id;
          await supabase
            .from("estimates")
            .update(estimateData)
            .eq("id", estimateId);
          console.log(`Updated existing estimate ${estimateData.number}`);
        } else {
          // Insert new estimate
          const { data: newEstimate, error: insertError } = await supabase
            .from("estimates")
            .insert(estimateData)
            .select("id")
            .single();

          if (insertError) {
            throw new Error(`Failed to insert estimate: ${insertError.message}`);
          }

          estimateId = newEstimate.id;
          console.log(`Created new estimate ${estimateData.number}`);
        }

        // Delete existing line items if updating
        if (existingEstimate) {
          await supabase
            .from("estimate_line_items")
            .delete()
            .eq("estimate_id", estimateId);
        }

        // Insert line items
        if (lineItems.length > 0) {
          const lineItemsWithEstimateId = lineItems.map((item, index) => ({
            ...item,
            estimate_id: estimateId,
            sort_order: index + 1,
          }));

          await supabase
            .from("estimate_line_items")
            .insert(lineItemsWithEstimateId);
        }

        // Create mapping
        await supabase
          .from("quickbooks_estimate_mappings")
          .upsert({
            estimate_id: estimateId,
            quickbooks_estimate_id: qbEstimateId,
            sync_status: "synced",
            last_synced_at: new Date().toISOString(),
          }, { onConflict: "quickbooks_estimate_id" });

        // Log sync
        await supabase.from("quickbooks_sync_log").insert({
          entity_type: "estimate",
          entity_id: estimateId,
          quickbooks_id: qbEstimateId,
          action: "import",
          status: "success",
          details: { number: estimateData.number, total: estimateData.total },
        });

        results.imported++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`Estimate ${qbEstimate.DocNumber}: ${message}`);
        console.error(`Error importing estimate ${qbEstimate.DocNumber}:`, error);
      }
    }

    console.log("Import results:", results);

    return new Response(
      JSON.stringify({
        success: true,
        totalInQuickBooks: qbEstimates.length,
        imported: results.imported,
        skipped: results.skipped,
        errors: results.errors,
        unmappedCustomers: results.unmappedCustomers,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error importing estimates from QuickBooks:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
