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

// Get or create vendor in QuickBooks
async function getOrCreateQBVendor(supabase: any, vendorId: string, accessToken: string, realmId: string): Promise<string> {
  // Check if vendor already mapped
  const { data: mapping } = await supabase
    .from('quickbooks_vendor_mappings')
    .select('quickbooks_vendor_id')
    .eq('vendor_id', vendorId)
    .single();

  if (mapping) {
    console.log(`Found existing vendor mapping: ${mapping.quickbooks_vendor_id}`);
    return mapping.quickbooks_vendor_id;
  }

  // Get vendor details
  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', vendorId)
    .single();

  if (vendorError || !vendor) {
    throw new Error(`Vendor not found: ${vendorId}`);
  }

  // First, search for existing vendor in QuickBooks by name
  console.log(`Searching QuickBooks for existing vendor: ${vendor.name}`);
  
  try {
    const searchQuery = encodeURIComponent(`SELECT * FROM Vendor WHERE DisplayName = '${vendor.name.replace(/'/g, "\\'")}'`);
    const searchResult = await qbRequest('GET', `/query?query=${searchQuery}&minorversion=65`, accessToken, realmId);
    
    if (searchResult.QueryResponse?.Vendor?.length > 0) {
      const existingVendor = searchResult.QueryResponse.Vendor[0];
      console.log(`Found existing QuickBooks vendor: ${existingVendor.DisplayName} (ID: ${existingVendor.Id})`);
      
      // Create mapping for existing vendor
      await supabase.from('quickbooks_vendor_mappings').insert({
        vendor_id: vendorId,
        quickbooks_vendor_id: existingVendor.Id,
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        sync_direction: 'export',
      });
      
      return existingVendor.Id;
    }
  } catch (e) {
    console.log(`Error searching for vendor, will try to create: ${e}`);
  }

  console.log(`Creating new vendor in QuickBooks: ${vendor.name}`);

  // Create vendor in QuickBooks
  const qbVendor = {
    DisplayName: vendor.name,
    CompanyName: vendor.company || vendor.name,
    PrimaryEmailAddr: vendor.email ? { Address: vendor.email } : undefined,
    PrimaryPhone: vendor.phone ? { FreeFormNumber: vendor.phone } : undefined,
    BillAddr: vendor.address ? {
      Line1: vendor.address,
    } : undefined,
    Active: vendor.status === 'active',
  };

  try {
    const result = await qbRequest('POST', '/vendor?minorversion=65', accessToken, realmId, qbVendor);
    const qbVendorId = result.Vendor.Id;

    // Create mapping
    await supabase.from('quickbooks_vendor_mappings').insert({
      vendor_id: vendorId,
      quickbooks_vendor_id: qbVendorId,
      sync_status: 'synced',
      last_synced_at: new Date().toISOString(),
      sync_direction: 'export',
    });

    console.log(`Created vendor in QuickBooks with ID: ${qbVendorId}`);
    return qbVendorId;
  } catch (createError: any) {
    // Handle duplicate name error - try to find by partial match
    if (createError.message?.includes('Duplicate Name Exists')) {
      console.log(`Duplicate name error, searching with LIKE query...`);
      
      const likeQuery = encodeURIComponent(`SELECT * FROM Vendor WHERE DisplayName LIKE '%${vendor.name.replace(/'/g, "\\'")}%' MAXRESULTS 10`);
      const likeResult = await qbRequest('GET', `/query?query=${likeQuery}&minorversion=65`, accessToken, realmId);
      
      if (likeResult.QueryResponse?.Vendor?.length > 0) {
        // Find best match (exact or closest)
        const exactMatch = likeResult.QueryResponse.Vendor.find(
          (v: any) => v.DisplayName.toLowerCase() === vendor.name.toLowerCase()
        );
        const matchedVendor = exactMatch || likeResult.QueryResponse.Vendor[0];
        
        console.log(`Found matching vendor after duplicate error: ${matchedVendor.DisplayName} (ID: ${matchedVendor.Id})`);
        
        await supabase.from('quickbooks_vendor_mappings').insert({
          vendor_id: vendorId,
          quickbooks_vendor_id: matchedVendor.Id,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
          sync_direction: 'export',
        });
        
        return matchedVendor.Id;
      }
    }
    
    throw createError;
  }
}

// Valid account types for expense accounts
const VALID_EXPENSE_ACCOUNT_TYPES = ['Expense', 'Cost of Goods Sold', 'Other Current Liability'];

// Cache for QuickBooks service items to avoid repeated API calls
const itemCache: Map<string, string> = new Map();

// Get or create a Service Item in QuickBooks for ItemBasedExpenseLineDetail
async function getOrCreateQBServiceItem(
  description: string,
  accessToken: string,
  realmId: string,
  expenseAccountRef: { value: string; name: string }
): Promise<string> {
  // Use a generic "Labor" item for all bill line items
  const itemName = "Labor";
  
  // Check cache first
  if (itemCache.has(itemName)) {
    console.log(`Using cached Service item: ${itemName}`);
    return itemCache.get(itemName)!;
  }
  
  // Search for existing item in QuickBooks
  console.log(`Searching QuickBooks for Service item: ${itemName}`);
  
  try {
    const searchQuery = encodeURIComponent(`SELECT * FROM Item WHERE Name = '${itemName}' MAXRESULTS 1`);
    const result = await qbRequest('GET', `/query?query=${searchQuery}&minorversion=65`, accessToken, realmId);
    
    if (result.QueryResponse?.Item?.length > 0) {
      const existingItem = result.QueryResponse.Item[0];
      console.log(`Found existing Service item: ${existingItem.Name} (ID: ${existingItem.Id})`);
      itemCache.set(itemName, existingItem.Id);
      return existingItem.Id;
    }
  } catch (e) {
    console.log(`Error searching for Service item: ${e}, will try to create`);
  }
  
  // Create a new Service item if not found
  console.log(`Creating new Service item in QuickBooks: ${itemName}`);
  
  const newItem = {
    Name: itemName,
    Type: "Service",
    ExpenseAccountRef: expenseAccountRef,
  };
  
  try {
    const createResult = await qbRequest('POST', '/item?minorversion=65', accessToken, realmId, newItem);
    const itemId = createResult.Item.Id;
    console.log(`Created Service item: ${itemName} (ID: ${itemId})`);
    itemCache.set(itemName, itemId);
    return itemId;
  } catch (createError: any) {
    // Handle duplicate name error
    if (createError.message?.includes('Duplicate Name Exists') || createError.message?.includes('6240')) {
      console.log(`Duplicate item name error, searching with LIKE query...`);
      
      const likeQuery = encodeURIComponent(`SELECT * FROM Item WHERE Name LIKE '%${itemName}%' MAXRESULTS 10`);
      const likeResult = await qbRequest('GET', `/query?query=${likeQuery}&minorversion=65`, accessToken, realmId);
      
      if (likeResult.QueryResponse?.Item?.length > 0) {
        const foundItem = likeResult.QueryResponse.Item[0];
        console.log(`Found existing item after duplicate error: ${foundItem.Name} (ID: ${foundItem.Id})`);
        itemCache.set(itemName, foundItem.Id);
        return foundItem.Id;
      }
    }
    
    throw createError;
  }
}

// Get expense account reference
async function getExpenseAccountRef(
  categoryName: string | null,
  accessToken: string,
  realmId: string
): Promise<{ value: string; name: string }> {
  
  if (categoryName) {
    console.log(`Searching QuickBooks for account matching category: ${categoryName}`);
    
    const searchQuery = encodeURIComponent(
      `SELECT * FROM Account WHERE Name LIKE '%${categoryName}%' MAXRESULTS 50`
    );
    
    try {
      const result = await qbRequest('GET', `/query?query=${searchQuery}&minorversion=65`, accessToken, realmId);
      
      if (result.QueryResponse?.Account?.length > 0) {
        const validAccounts = result.QueryResponse.Account.filter(
          (acc: any) => VALID_EXPENSE_ACCOUNT_TYPES.includes(acc.AccountType)
        );
        
        if (validAccounts.length > 0) {
          const exactMatch = validAccounts.find(
            (acc: any) => acc.Name.toLowerCase() === categoryName.toLowerCase()
          );
          
          if (exactMatch) {
            console.log(`Found exact match account: ${exactMatch.Name} (${exactMatch.Id})`);
            return { value: exactMatch.Id, name: exactMatch.Name };
          }
          
          const account = validAccounts[0];
          console.log(`Found partial match account: ${account.Name} (${account.Id})`);
          return { value: account.Id, name: account.Name };
        }
      }
      
      console.log(`No matching account found for category: ${categoryName}, will use default`);
    } catch (e) {
      console.log(`Error searching for category account: ${e}, will use default`);
    }
  }

  // Fallback: Query for a Cost of Goods Sold account
  const cogsQuery = encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Cost of Goods Sold' MAXRESULTS 1");
  
  try {
    const result = await qbRequest('GET', `/query?query=${cogsQuery}&minorversion=65`, accessToken, realmId);
    
    if (result.QueryResponse?.Account?.length > 0) {
      const account = result.QueryResponse.Account[0];
      console.log(`Using default COGS account: ${account.Name} (${account.Id})`);
      return { value: account.Id, name: account.Name };
    }
  } catch (e) {
    console.log('Could not find COGS account, trying Expense account');
  }

  // Final fallback to expense account
  const expenseQuery = encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Expense' MAXRESULTS 1");
  const expenseResult = await qbRequest('GET', `/query?query=${expenseQuery}&minorversion=65`, accessToken, realmId);
  
  if (expenseResult.QueryResponse?.Account?.length > 0) {
    const account = expenseResult.QueryResponse.Account[0];
    console.log(`Using default Expense account: ${account.Name} (${account.Id})`);
    return { value: account.Id, name: account.Name };
  }

  throw new Error('No expense account found in QuickBooks');
}

serve(async (req) => {
  // Clear item cache for each request to ensure fresh data
  itemCache.clear();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { billId } = await req.json();
    console.log("Updating QuickBooks bill for local bill:", billId);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if bill is synced to QuickBooks
    const { data: mapping, error: mappingError } = await supabase
      .from("quickbooks_bill_mappings")
      .select("quickbooks_bill_id, sync_status")
      .eq("bill_id", billId)
      .maybeSingle();

    if (mappingError) {
      console.error("Mapping fetch error:", mappingError);
      throw new Error("Failed to check QuickBooks mapping");
    }

    if (!mapping) {
      console.log("Bill not synced to QuickBooks, nothing to update");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Bill not synced to QuickBooks",
          updated: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if voided
    if (mapping.sync_status === "voided") {
      console.log("Bill already voided in QuickBooks, skipping update");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Bill already voided in QuickBooks",
          updated: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qbBillId = mapping.quickbooks_bill_id;
    console.log("Found QB bill mapping:", qbBillId);

    // Fetch bill with line items from local DB
    const { data: bill, error: billError } = await supabase
      .from("vendor_bills")
      .select("*")
      .eq("id", billId)
      .single();

    if (billError || !bill) {
      throw new Error("Vendor bill not found");
    }

    const { data: lineItems, error: lineItemsError } = await supabase
      .from("vendor_bill_line_items")
      .select("*")
      .eq("bill_id", billId);

    if (lineItemsError) {
      throw lineItemsError;
    }

    // Get valid token
    const { accessToken, realmId } = await getValidToken(supabase);

    // Fetch the current QB bill to get SyncToken
    console.log("Fetching QB bill to get SyncToken...");
    const qbBillData = await qbRequest(
      "GET",
      `/bill/${qbBillId}`,
      accessToken,
      realmId
    );

    const syncToken = qbBillData.Bill.SyncToken;
    console.log("Got SyncToken:", syncToken);

    // Get or create vendor in QuickBooks (auto-sync if not mapped)
    const qbVendorId = await getOrCreateQBVendor(supabase, bill.vendor_id, accessToken, realmId);

    // Build a map of category IDs to category names
    const categoryMap: Map<string, string> = new Map();
    if (lineItems && lineItems.length > 0) {
      const categoryIds = lineItems
        .map((item: any) => item.category_id)
        .filter((id: string | null) => id !== null);
      
      if (categoryIds.length > 0) {
        const { data: categories } = await supabase
          .from('expense_categories')
          .select('id, name')
          .in('id', categoryIds);
        
        if (categories) {
          for (const cat of categories) {
            categoryMap.set(cat.id, cat.name);
          }
        }
      }
    }

    // Build updated QuickBooks bill line items
    const qbLineItems = [];

    if (lineItems && lineItems.length > 0) {
      for (const item of lineItems) {
        const categoryName = item.category_id ? categoryMap.get(item.category_id) || null : null;
        const expenseAccountRef = await getExpenseAccountRef(categoryName, accessToken, realmId);
        
        // Get or create a Service item for ItemBasedExpenseLineDetail
        const qbItemId = await getOrCreateQBServiceItem(item.description, accessToken, realmId, expenseAccountRef);
        
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unit_cost) || Number(item.total);
        
        console.log(`Line item "${item.description}" -> Qty: ${qty}, Unit Price: ${unitPrice} -> QB Account: ${expenseAccountRef.name}`);
        
        qbLineItems.push({
          DetailType: 'ItemBasedExpenseLineDetail',
          Amount: Number(item.total),
          Description: item.description,
          ItemBasedExpenseLineDetail: {
            ItemRef: { value: qbItemId },
            Qty: qty,
            UnitPrice: unitPrice,
            BillableStatus: 'NotBillable',
          },
        });
      }
    } else {
      const defaultAccountRef = await getExpenseAccountRef(null, accessToken, realmId);
      const qbItemId = await getOrCreateQBServiceItem(`Bill ${bill.number}`, accessToken, realmId, defaultAccountRef);
      qbLineItems.push({
        DetailType: 'ItemBasedExpenseLineDetail',
        Amount: Number(bill.subtotal),
        Description: `Bill ${bill.number}`,
        ItemBasedExpenseLineDetail: {
          ItemRef: { value: qbItemId },
          Qty: 1,
          UnitPrice: Number(bill.subtotal),
          BillableStatus: 'NotBillable',
        },
      });
    }

    // Build updated QB bill
    const qbBill: any = {
      Id: qbBillId,
      SyncToken: syncToken,
      VendorRef: { value: qbVendorId },
      Line: qbLineItems,
      TxnDate: bill.bill_date,
      DueDate: bill.due_date,
      DocNumber: bill.number,
      PrivateNote: bill.notes || `CommandX Vendor Bill: ${bill.number}`,
    };

    console.log("Updating bill in QuickBooks:", JSON.stringify(qbBill, null, 2));

    const result = await qbRequest(
      "POST",
      "/bill?minorversion=65",
      accessToken,
      realmId,
      qbBill
    );

    console.log("QuickBooks bill updated:", result.Bill.Id);

    // Update mapping timestamp
    await supabase
      .from("quickbooks_bill_mappings")
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: "synced",
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("bill_id", billId);

    // Log sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "vendor_bill",
      entity_id: billId,
      quickbooks_id: qbBillId,
      action: "update",
      status: "success",
      details: { number: bill.number, total: bill.total },
    });

    return new Response(
      JSON.stringify({
        success: true,
        quickbooksBillId: qbBillId,
        message: "Bill updated in QuickBooks",
        updated: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating QuickBooks bill:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: errorMessage, updated: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
