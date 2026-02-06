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

  // Capture auth header for forwarding to downstream functions
  const authHeader = req.headers.get("Authorization");

  try {
    const { invoiceId } = await req.json();
    console.log("Updating QuickBooks invoice for:", invoiceId);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if invoice is synced to QuickBooks
    const { data: mapping, error: mappingError } = await supabase
      .from("quickbooks_invoice_mappings")
      .select("quickbooks_invoice_id, sync_status")
      .eq("invoice_id", invoiceId)
      .maybeSingle();

    if (mappingError) {
      console.error("Mapping fetch error:", mappingError);
      throw new Error("Failed to check QuickBooks mapping");
    }

    if (!mapping) {
      console.log("Invoice not synced to QuickBooks, nothing to update");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Invoice not synced to QuickBooks",
          updated: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if voided/deleted
    if (mapping.sync_status === "voided" || mapping.sync_status === "deleted") {
      console.log("Invoice already voided/deleted in QuickBooks, skipping update");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Invoice already voided/deleted in QuickBooks",
          updated: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qbInvoiceId = mapping.quickbooks_invoice_id;
    console.log("Found QB invoice mapping:", qbInvoiceId);

    // Fetch invoice with line items from local DB
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found");
    }

    // Validate locked period BEFORE syncing to QuickBooks
    const periodCheck = await validateLockedPeriod(
      supabase,
      invoice.date || invoice.created_at?.split('T')[0],
      'invoice',
      invoiceId,
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
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("display_order", { ascending: true });

    if (lineItemsError) {
      throw lineItemsError;
    }

    // Get valid token
    const { accessToken, realmId } = await getValidToken(supabase);

    // Fetch the current QB invoice to get SyncToken
    console.log("Fetching QB invoice to get SyncToken...");
    const qbInvoiceData = await qbRequest(
      "GET",
      `/invoice/${qbInvoiceId}`,
      accessToken,
      realmId
    );

    const syncToken = qbInvoiceData.Invoice.SyncToken;
    console.log("Got SyncToken:", syncToken);

    // Get or create customer in QuickBooks using fetch with auth forwarding
    console.log("Syncing customer to QuickBooks...");
    const customerResponse = await fetch(`${SUPABASE_URL}/functions/v1/quickbooks-sync-customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || '',
      },
      body: JSON.stringify({ action: "find-or-create", customerId: invoice.customer_id }),
    });

    if (!customerResponse.ok) {
      const errorText = await customerResponse.text();
      console.error("Customer sync failed:", errorText);
      throw new Error(`Customer sync failed: ${customerResponse.status}`);
    }

    const customerSyncResult = await customerResponse.json();
    const qbCustomerId = customerSyncResult.quickbooksCustomerId;
    if (!qbCustomerId) {
      throw new Error("Failed to get QuickBooks customer ID");
    }

    // Get product mappings
    const productIds = lineItems
      .filter((item: any) => item.product_id)
      .map((item: any) => item.product_id);

    let qbItemMap = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: productMappings } = await supabase
        .from("quickbooks_product_mappings")
        .select("product_id, quickbooks_item_id")
        .in("product_id", productIds);

      if (productMappings) {
        qbItemMap = new Map(
          productMappings.map((m: any) => [m.product_id, m.quickbooks_item_id])
        );
      }
    }

    // Build line items for QuickBooks
    const qbLineItems = [];
    for (const item of lineItems) {
      const qty = Number(item.quantity) || 0;
      const total = Number(item.total) || 0;
      const effectiveUnitPrice = qty > 0 ? Number((total / qty).toFixed(5)) : Number(item.unit_price) || 0;
      const qbAmount = Number((effectiveUnitPrice * qty).toFixed(2));

      const qbItemId = item.product_id ? qbItemMap.get(item.product_id) : null;
      const qbDescription = qbItemId
        ? item.description
        : (item.product_name
            ? `${item.product_name} - ${item.description}`
            : item.description);

      const lineItem: any = {
        DetailType: "SalesItemLineDetail",
        Amount: qbAmount,
        Description: qbDescription,
        SalesItemLineDetail: {
          Qty: qty,
          UnitPrice: effectiveUnitPrice,
          TaxCodeRef: { value: "NON" },
        },
      };

      if (qbItemId) {
        lineItem.SalesItemLineDetail.ItemRef = { value: qbItemId };
      }

      qbLineItems.push(lineItem);
    }

    // Add tax line if applicable
    if (invoice.tax_amount > 0) {
      qbLineItems.push({
        DetailType: "SalesItemLineDetail",
        Amount: invoice.tax_amount,
        Description: `Tax (${invoice.tax_rate}%)`,
        SalesItemLineDetail: {
          Qty: 1,
          UnitPrice: invoice.tax_amount,
          TaxCodeRef: { value: "NON" },
        },
      });
    }

    // Build PrivateNote
    const privateNoteParts = [
      invoice.notes,
      invoice.project_name ? `Project: ${invoice.project_name}` : null,
    ].filter(Boolean);

    // Build updated QuickBooks invoice
    const qbInvoice: any = {
      Id: qbInvoiceId,
      SyncToken: syncToken,
      CustomerRef: { value: qbCustomerId },
      DocNumber: invoice.number,
      TxnDate: invoice.created_at.split("T")[0],
      DueDate: invoice.due_date,
      Line: qbLineItems,
      GlobalTaxCalculation: "TaxExcluded",
      PrivateNote: privateNoteParts.length > 0 ? privateNoteParts.join("\n") : undefined,
    };

    console.log("Updating invoice in QuickBooks:", JSON.stringify(qbInvoice, null, 2));

    const result = await qbRequest(
      "POST",
      "/invoice?minorversion=65",
      accessToken,
      realmId,
      qbInvoice
    );

    console.log("QuickBooks invoice updated:", result.Invoice.Id);

    // Update mapping timestamp
    await supabase
      .from("quickbooks_invoice_mappings")
      .update({
        synced_at: new Date().toISOString(),
        sync_status: "synced",
      })
      .eq("invoice_id", invoiceId);

    // Log sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "invoice",
      entity_id: invoiceId,
      quickbooks_id: qbInvoiceId,
      action: "update",
      status: "success",
      details: { number: invoice.number, total: invoice.total },
    });

    return new Response(
      JSON.stringify({
        success: true,
        quickbooksInvoiceId: qbInvoiceId,
        message: "Invoice updated in QuickBooks",
        updated: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating QuickBooks invoice:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: errorMessage, updated: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
