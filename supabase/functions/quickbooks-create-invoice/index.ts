import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateLockedPeriod } from "../_shared/lockedPeriodValidator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Authentication helper - validates user and checks admin/manager role
async function authenticateRequest(req: Request): Promise<{ userId: string; error?: never } | { userId?: never; error: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("No authorization header provided");
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    };
  }

  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    console.error("User authentication failed:", userError);
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    };
  }

  // Check user role - only admin and manager can use QuickBooks functions
  const { data: roleData, error: roleError } = await supabaseClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (roleError) {
    console.error("Error fetching user role:", roleError);
  }

  if (!roleData || !['admin', 'manager'].includes(roleData.role)) {
    console.error("User does not have admin/manager role:", user.id);
    return {
      error: new Response(JSON.stringify({ error: "Insufficient permissions. Only admins and managers can access QuickBooks functions." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    };
  }

  console.log(`Authenticated user ${user.id} with role ${roleData.role}`);
  return { userId: user.id };
}

// Helper to get valid access token
async function getValidToken(supabase: any) {
  const { data: config, error } = await supabase
    .from('quickbooks_config')
    .select('*')
    .eq('is_connected', true)
    .single();

  if (error || !config) {
    throw new Error('QuickBooks not connected');
  }

  const tokenExpires = new Date(config.token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (tokenExpires < fiveMinutesFromNow) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/quickbooks-oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ action: 'refresh-token' }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const { access_token, realm_id } = await response.json();
    return { accessToken: access_token, realmId: realm_id };
  }

  return { accessToken: config.access_token, realmId: config.realm_id };
}

// QuickBooks API helper with defensive parsing
async function qbRequest(method: string, endpoint: string, accessToken: string, realmId: string, body?: any) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'identity', // Prevent gzip encoding issues
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'LovableCloud/1.0',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  // Log response metadata for debugging
  console.log(`QB API ${method} ${endpoint} - Status: ${response.status}, Content-Type: ${response.headers.get('content-type')}, Content-Encoding: ${response.headers.get('content-encoding')}`);
  
  // Use defensive text-first parsing
  let responseText: string;
  try {
    responseText = await response.text();
  } catch (textError) {
    console.error('Failed to read response body:', textError);
    throw new Error(`QuickBooks API response read error: ${textError}`);
  }
  
  if (!response.ok) {
    console.error(`QuickBooks API error response: ${responseText}`);
    throw new Error(`QuickBooks API error: ${response.status} - ${responseText.substring(0, 200)}`);
  }

  // Parse JSON from text
  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    console.error('Failed to parse QB response as JSON. Raw text:', responseText.substring(0, 500));
    throw new Error(`QuickBooks API returned invalid JSON: ${parseError}`);
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if (authResult.error) {
      return authResult.error;
    }

    const { invoiceId } = await req.json();
    console.log("Creating QuickBooks invoice for:", invoiceId, "by user:", authResult.userId);

    // Create Supabase client with service role for database operations
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get valid token
    const { accessToken, realmId } = await getValidToken(supabase);

    // Fetch invoice with line items (ordered by display_order)
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        line_items:invoice_line_items(*)
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      console.error("Invoice fetch error:", invoiceError);
      throw new Error("Invoice not found");
    }

    // Validate locked period BEFORE syncing to QuickBooks
    const periodCheck = await validateLockedPeriod(
      supabase,
      invoice.date || invoice.created_at?.split('T')[0],
      'invoice',
      invoiceId,
      authResult.userId,
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
    
    // Sort line items by display_order
    if (invoice.line_items) {
      invoice.line_items.sort((a: any, b: any) => {
        const orderA = a.display_order ?? 999;
        const orderB = b.display_order ?? 999;
        return orderA - orderB;
      });
    }

    // Check if already synced
    const { data: existingMapping } = await supabase
      .from("quickbooks_invoice_mappings")
      .select("quickbooks_invoice_id")
      .eq("invoice_id", invoiceId)
      .maybeSingle();

    if (existingMapping?.quickbooks_invoice_id) {
      console.log("Invoice already synced:", existingMapping.quickbooks_invoice_id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          quickbooksInvoiceId: existingMapping.quickbooks_invoice_id,
          message: "Already synced" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find or create QuickBooks customer - use fetch with auth forwarding
    const authHeader = req.headers.get("Authorization");
    const customerResponse = await fetch(`${SUPABASE_URL}/functions/v1/quickbooks-sync-customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || '',
      },
      body: JSON.stringify({ 
        action: 'find-or-create',
        customerId: invoice.customer_id
      })
    });

    if (!customerResponse.ok) {
      const errorData = await customerResponse.json().catch(() => ({}));
      throw new Error(`Customer sync failed: ${errorData.error || customerResponse.statusText}`);
    }

    const customerData = await customerResponse.json();
    const qbCustomerId = customerData?.quickbooksCustomerId;
    if (!qbCustomerId) {
      throw new Error("Could not get QuickBooks customer ID");
    }

    console.log("Using QB customer:", qbCustomerId);

    // Get product mappings for line items that have product_id
    const productIds = invoice.line_items
      .filter((item: any) => item.product_id)
      .map((item: any) => item.product_id);

    let qbItemMap = new Map<string, string>();
    if (productIds.length > 0) {
      // First check existing mappings
      const { data: productMappings } = await supabase
        .from("quickbooks_product_mappings")
        .select("product_id, quickbooks_item_id")
        .in("product_id", productIds);

      if (productMappings) {
        qbItemMap = new Map(
          productMappings.map((m: any) => [m.product_id, m.quickbooks_item_id])
        );
      }
      console.log("Found existing QB product mappings:", qbItemMap.size, "of", productIds.length);

      // Auto-sync unmapped products to QuickBooks
      const unmappedProductIds = productIds.filter((id: string) => !qbItemMap.has(id));
      if (unmappedProductIds.length > 0) {
        console.log("Auto-syncing", unmappedProductIds.length, "unmapped products to QuickBooks...");
        
        for (const productId of unmappedProductIds) {
          try {
            const syncResponse = await fetch(`${SUPABASE_URL}/functions/v1/quickbooks-sync-products`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader || '',
              },
              body: JSON.stringify({ 
                action: 'sync-single',
                productId: productId
              })
            });

            if (!syncResponse.ok) {
              console.warn(`Failed to sync product ${productId}:`, await syncResponse.text());
            } else {
              const syncData = await syncResponse.json();
              if (syncData?.quickbooksItemId) {
                console.log(`Successfully synced product ${productId} to QB item ${syncData.quickbooksItemId}`);
                qbItemMap.set(productId, syncData.quickbooksItemId);
              }
            }
          } catch (syncError) {
            console.warn(`Error syncing product ${productId}:`, syncError);
          }
        }
        
        console.log("After auto-sync, have QB mappings:", qbItemMap.size);
      }
    }

    // Fallback: For line items without product_id, try to look up by product_name
    const productNamesWithoutId = invoice.line_items
      .filter((item: any) => !item.product_id && item.product_name)
      .map((item: any) => item.product_name);

    let qbItemByNameMap = new Map<string, string>();
    if (productNamesWithoutId.length > 0) {
      // First get the product IDs by name
      const { data: productsByName } = await supabase
        .from("products")
        .select("id, name")
        .in("name", productNamesWithoutId);

      if (productsByName && productsByName.length > 0) {
        const foundProductIds = productsByName.map((p: any) => p.id);
        
        // Get QB mappings for these products
        const { data: productMappingsByName } = await supabase
          .from("quickbooks_product_mappings")
          .select("product_id, quickbooks_item_id")
          .in("product_id", foundProductIds);

        if (productMappingsByName) {
          // Create a map from product_id to qb_item_id
          const idToQbMap = new Map(
            productMappingsByName.map((m: any) => [m.product_id, m.quickbooks_item_id])
          );
          
          // Create a map from product_name to qb_item_id
          for (const product of productsByName) {
            const qbId = idToQbMap.get(product.id);
            if (qbId) {
              qbItemByNameMap.set(product.name, qbId);
            }
          }
        }
        console.log("Found QB product mappings by name:", qbItemByNameMap.size);
      }
    }

    // Build line items for QuickBooks
    const qbLineItems = [];
    for (const item of invoice.line_items) {
      // QuickBooks requires Amount = Qty * UnitPrice.
      // Our stored totals may include markup/margin logic, so we derive UnitPrice from total/qty.
      // Use higher precision on UnitPrice to avoid rounding mismatches.
      const qty = Number(item.quantity) || 0;
      const total = Number(item.total) || 0;

      const effectiveUnitPrice = qty > 0 ? Number((total / qty).toFixed(5)) : Number(item.unit_price) || 0;
      const qbAmount = Number((effectiveUnitPrice * qty).toFixed(2));
      
      // Get QB Item ID - first try by product_id, then fallback to name lookup
      let qbItemId = item.product_id ? qbItemMap.get(item.product_id) : null;
      if (!qbItemId && item.product_name) {
        qbItemId = qbItemByNameMap.get(item.product_name);
      }
      
      // Build description - only include product name in description if NOT using ItemRef
      // When using ItemRef, QuickBooks shows the product name in Product/service column
      const qbDescription = qbItemId 
        ? item.description  // Just the description since product name shows in Product/service
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
          TaxCodeRef: { value: "NON" }, // Mark as non-taxable
        },
      };

      // Add ItemRef if we have a mapped product
      if (qbItemId) {
        lineItem.SalesItemLineDetail.ItemRef = { value: qbItemId };
        console.log(`Line item "${item.product_name || item.description}" mapped to QB Item: ${qbItemId}`);
      } else {
        console.log(`Line item "${item.product_name || item.description}" has no QB mapping`);
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
          TaxCodeRef: { value: "NON" }, // Mark as non-taxable
        },
      });
    }

    // Build PrivateNote combining custom notes and project reference
    const privateNoteParts = [
      invoice.notes,
      invoice.project_name ? `Project: ${invoice.project_name}` : null,
    ].filter(Boolean);

    // Create QuickBooks invoice with tax calculation disabled
    const qbInvoice = {
      CustomerRef: { value: qbCustomerId },
      DocNumber: invoice.number,
      TxnDate: invoice.created_at.split("T")[0],
      DueDate: invoice.due_date,
      Line: qbLineItems,
      GlobalTaxCalculation: "TaxExcluded", // Disable QB automatic tax - we handle tax manually
      PrivateNote: privateNoteParts.length > 0 ? privateNoteParts.join("\n") : undefined,
    };

    console.log("Creating QB invoice:", JSON.stringify(qbInvoice, null, 2));

    const qbResponse = await qbRequest("POST", "/invoice", accessToken, realmId, qbInvoice);
    const qbInvoiceId = qbResponse.Invoice.Id;

    console.log("Created QB invoice:", qbInvoiceId);

    // Save mapping
    await supabase.from("quickbooks_invoice_mappings").insert({
      invoice_id: invoiceId,
      quickbooks_invoice_id: qbInvoiceId,
    });

    // Log sync
    await supabase.from("quickbooks_sync_logs").insert({
      entity_type: "invoice",
      entity_id: invoiceId,
      action: "create",
      status: "success",
      details: { quickbooks_invoice_id: qbInvoiceId },
    });

    return new Response(
      JSON.stringify({ success: true, quickbooksInvoiceId: qbInvoiceId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("QuickBooks invoice sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
