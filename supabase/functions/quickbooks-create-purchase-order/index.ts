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

async function getOrCreateQBVendor(
  supabase: any,
  vendorId: string,
  accessToken: string,
  realmId: string
): Promise<string> {
  // Check for existing mapping
  const { data: mapping } = await supabase
    .from("quickbooks_vendor_mappings")
    .select("quickbooks_vendor_id")
    .eq("vendor_id", vendorId)
    .single();

  if (mapping?.quickbooks_vendor_id) {
    return mapping.quickbooks_vendor_id;
  }

  // Get vendor from Supabase
  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", vendorId)
    .single();

  if (vendorError || !vendor) {
    throw new Error("Vendor not found");
  }

  // Normalize vendor name (trim whitespace)
  const normalizedName = vendor.name.trim();
  const vendorNameEscaped = normalizedName.replace(/'/g, "\\'");
  const searchQuery = `SELECT * FROM Vendor WHERE DisplayName = '${vendorNameEscaped}'`;
  
  try {
    const searchResult = await qbRequest(
      "GET",
      `/query?query=${encodeURIComponent(searchQuery)}`,
      accessToken,
      realmId
    );
    
    if (searchResult.QueryResponse?.Vendor?.[0]) {
      const existingQBVendor = searchResult.QueryResponse.Vendor[0];
      console.log("Found existing QuickBooks vendor:", existingQBVendor.Id, existingQBVendor.DisplayName);
      
      // Create mapping for existing vendor
      await supabase.from("quickbooks_vendor_mappings").insert({
        vendor_id: vendorId,
        quickbooks_vendor_id: existingQBVendor.Id,
        sync_status: "synced",
        sync_direction: "export",
        last_synced_at: new Date().toISOString(),
      });
      
      return existingQBVendor.Id;
    }
  } catch (searchError) {
    console.log("Vendor search failed, will try to create:", searchError);
  }

  // Create in QuickBooks with normalized name
  const qbVendorData: any = {
    DisplayName: normalizedName,
    CompanyName: vendor.company?.trim() || normalizedName,
    PrimaryEmailAddr: vendor.email ? { Address: vendor.email } : undefined,
    PrimaryPhone: vendor.phone ? { FreeFormNumber: vendor.phone } : undefined,
  };

  if (vendor.address || vendor.city || vendor.state || vendor.zip) {
    qbVendorData.BillAddr = {
      Line1: vendor.address || undefined,
      City: vendor.city || undefined,
      CountrySubDivisionCode: vendor.state || undefined,
      PostalCode: vendor.zip || undefined,
    };
  }

  try {
    const result = await qbRequest("POST", "/vendor?minorversion=65", accessToken, realmId, qbVendorData);
    const qbVendorId = result.Vendor.Id;

    // Create mapping
    await supabase.from("quickbooks_vendor_mappings").insert({
      vendor_id: vendorId,
      quickbooks_vendor_id: qbVendorId,
      sync_status: "synced",
      sync_direction: "export",
      last_synced_at: new Date().toISOString(),
    });

    return qbVendorId;
  } catch (createError: any) {
    // Handle duplicate name error - extract ID from error message first
    if (createError.message?.includes("Duplicate Name Exists") || createError.message?.includes("6240") || createError.message?.includes("400")) {
      console.log("Duplicate name error detected, attempting to extract ID from error...");
      
      // Extract ID from error message: "The name supplied already exists. : Id=1209"
      const idMatch = createError.message.match(/Id=(\d+)/);
      if (idMatch) {
        const existingVendorId = idMatch[1];
        console.log(`Extracted existing vendor ID from error: ${existingVendorId}`);
        
        // Create mapping directly using the extracted ID
        await supabase.from("quickbooks_vendor_mappings").insert({
          vendor_id: vendorId,
          quickbooks_vendor_id: existingVendorId,
          sync_status: "synced",
          sync_direction: "export",
          last_synced_at: new Date().toISOString(),
        });
        
        return existingVendorId;
      }
      
      // Fallback: fuzzy search with normalized name
      console.log("ID not in error message, attempting fuzzy search...");
      const fuzzyQuery = `SELECT * FROM Vendor WHERE DisplayName LIKE '%${normalizedName.split(" ")[0]}%'`;
      const fuzzyResult = await qbRequest(
        "GET",
        `/query?query=${encodeURIComponent(fuzzyQuery)}`,
        accessToken,
        realmId
      );
      
      if (fuzzyResult.QueryResponse?.Vendor?.length > 0) {
        // Find best match using normalized comparison
        const exactMatch = fuzzyResult.QueryResponse.Vendor.find(
          (v: any) => v.DisplayName.trim().toLowerCase() === normalizedName.toLowerCase()
        );
        const existingQBVendor = exactMatch || fuzzyResult.QueryResponse.Vendor[0];
        console.log("Found vendor via fuzzy search:", existingQBVendor.Id, existingQBVendor.DisplayName);
        
        await supabase.from("quickbooks_vendor_mappings").insert({
          vendor_id: vendorId,
          quickbooks_vendor_id: existingQBVendor.Id,
          sync_status: "synced",
          sync_direction: "export",
          last_synced_at: new Date().toISOString(),
        });
        
        return existingQBVendor.Id;
      }
    }
    throw createError;
  }
}

async function getExpenseAccountRef(accessToken: string, realmId: string) {
  // Find a suitable expense account for PO line items
  const query = "SELECT * FROM Account WHERE AccountType = 'Cost of Goods Sold' MAXRESULTS 1";
  let result = await qbRequest("GET", `/query?query=${encodeURIComponent(query)}`, accessToken, realmId);
  
  if (result.QueryResponse?.Account?.[0]) {
    return {
      value: result.QueryResponse.Account[0].Id,
      name: result.QueryResponse.Account[0].Name,
    };
  }

  // Fallback to expense account
  const expenseQuery = "SELECT * FROM Account WHERE AccountType = 'Expense' MAXRESULTS 1";
  result = await qbRequest("GET", `/query?query=${encodeURIComponent(expenseQuery)}`, accessToken, realmId);
  
  if (result.QueryResponse?.Account?.[0]) {
    return {
      value: result.QueryResponse.Account[0].Id,
      name: result.QueryResponse.Account[0].Name,
    };
  }

  throw new Error("No suitable expense account found in QuickBooks");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { purchaseOrderId } = await req.json();
    console.log("Creating QuickBooks purchase order for:", purchaseOrderId);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if already synced
    const { data: existingMapping } = await supabase
      .from("quickbooks_po_mappings")
      .select("*")
      .eq("purchase_order_id", purchaseOrderId)
      .single();

    if (existingMapping) {
      return new Response(
        JSON.stringify({
          success: true,
          quickbooksPOId: existingMapping.quickbooks_po_id,
          message: "Purchase order already synced",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch purchase order with line items
    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("id", purchaseOrderId)
      .single();

    if (poError || !po) {
      throw new Error("Purchase order not found");
    }

    const { data: lineItems, error: lineItemsError } = await supabase
      .from("po_line_items")
      .select("*")
      .eq("purchase_order_id", purchaseOrderId);

    if (lineItemsError) {
      throw lineItemsError;
    }

    const { accessToken, realmId } = await getValidToken(supabase);

    // Get or create vendor in QuickBooks
    const qbVendorId = await getOrCreateQBVendor(supabase, po.vendor_id, accessToken, realmId);

    // Get expense account for line items
    const expenseAccountRef = await getExpenseAccountRef(accessToken, realmId);

    // Build QuickBooks purchase order using AccountBasedExpenseLineDetail
    // This is simpler and doesn't require item catalog entries
    const qbLineItems = lineItems.map((item: any, index: number) => ({
      LineNum: index + 1,
      Amount: item.total,
      DetailType: "AccountBasedExpenseLineDetail",
      AccountBasedExpenseLineDetail: {
        AccountRef: {
          value: expenseAccountRef.value,
          name: expenseAccountRef.name,
        },
        Qty: item.quantity,
        UnitPrice: item.unit_price * (1 + (item.markup || 0) / 100),
      },
      Description: item.description,
    }));

    const qbPurchaseOrder: any = {
      VendorRef: { value: qbVendorId },
      DocNumber: po.number,
      TxnDate: po.created_at.split("T")[0],
      DueDate: po.due_date,
      Line: qbLineItems,
      Memo: po.notes || "",
    };

    console.log("Creating purchase order in QuickBooks:", JSON.stringify(qbPurchaseOrder, null, 2));

    const result = await qbRequest(
      "POST",
      "/purchaseorder?minorversion=65",
      accessToken,
      realmId,
      qbPurchaseOrder
    );

    const qbPOId = result.PurchaseOrder.Id;
    console.log("QuickBooks purchase order created:", qbPOId);

    // Create mapping
    await supabase.from("quickbooks_po_mappings").insert({
      purchase_order_id: purchaseOrderId,
      quickbooks_po_id: qbPOId,
      sync_status: "synced",
      last_synced_at: new Date().toISOString(),
    });

    // Log sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "purchase_order",
      entity_id: purchaseOrderId,
      quickbooks_id: qbPOId,
      action: "create",
      status: "success",
      details: { number: po.number, total: po.total },
    });

    return new Response(
      JSON.stringify({
        success: true,
        quickbooksPOId: qbPOId,
        quickbooksDocNumber: result.PurchaseOrder.DocNumber,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating QuickBooks purchase order:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
