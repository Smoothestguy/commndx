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

  // Normalize vendor name (trim whitespace)
  const normalizedName = vendor.name.trim();
  console.log(`Searching QuickBooks for existing vendor: "${normalizedName}"`);
  
  try {
    const searchQuery = encodeURIComponent(`SELECT * FROM Vendor WHERE DisplayName = '${normalizedName.replace(/'/g, "\\'")}'`);
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

  console.log(`Creating new vendor in QuickBooks: ${normalizedName}`);

  // Create vendor in QuickBooks with normalized name
  const qbVendor = {
    DisplayName: normalizedName,
    CompanyName: vendor.company?.trim() || normalizedName,
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
    // Handle duplicate name error - extract ID from error message first
    if (createError.message?.includes('Duplicate Name Exists') || createError.message?.includes('6240')) {
      console.log(`Duplicate name error detected, attempting to extract ID from error...`);
      
      // Extract ID from error message: "The name supplied already exists. : Id=1209"
      const idMatch = createError.message.match(/Id=(\d+)/);
      if (idMatch) {
        const existingVendorId = idMatch[1];
        console.log(`Extracted existing vendor ID from error: ${existingVendorId}`);
        
        // Create mapping directly using the extracted ID
        await supabase.from('quickbooks_vendor_mappings').insert({
          vendor_id: vendorId,
          quickbooks_vendor_id: existingVendorId,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
          sync_direction: 'export',
        });
        
        return existingVendorId;
      }
      
      // Fallback: search with LIKE query using normalized name
      console.log(`ID not in error message, searching with LIKE query...`);
      const likeQuery = encodeURIComponent(`SELECT * FROM Vendor WHERE DisplayName LIKE '%${normalizedName.replace(/'/g, "\\'")}%' MAXRESULTS 10`);
      const likeResult = await qbRequest('GET', `/query?query=${likeQuery}&minorversion=65`, accessToken, realmId);
      
      if (likeResult.QueryResponse?.Vendor?.length > 0) {
        // Find best match (exact or closest) using normalized comparison
        const exactMatch = likeResult.QueryResponse.Vendor.find(
          (v: any) => v.DisplayName.trim().toLowerCase() === normalizedName.toLowerCase()
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

    // Validate locked period BEFORE syncing to QuickBooks
    const periodCheck = await validateLockedPeriod(
      supabase,
      bill.bill_date,
      'vendor_bill',
      billId,
      "system", // update-bill is called from hooks, may not have user context
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
    // Build a map of QB product mapping IDs to QB item references
    const qbProductMap: Map<string, { qb_item_id: string; name: string }> = new Map();

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

      // Fetch QB product mappings for line items that have them
      const qbMappingIds = lineItems
        .map((item: any) => item.qb_product_mapping_id)
        .filter((id: string | null) => id !== null);
      
      if (qbMappingIds.length > 0) {
        const { data: mappings } = await supabase
          .from('qb_product_service_mappings')
          .select('id, name, quickbooks_item_id')
          .in('id', qbMappingIds);
        
        if (mappings) {
          for (const m of mappings) {
            if (m.quickbooks_item_id) {
              qbProductMap.set(m.id, { qb_item_id: m.quickbooks_item_id, name: m.name });
            }
          }
        }
      }
    }

    // AUTO-RESOLVE: Determine if bill should use Item Details (billable) or Category Details
    // A bill is "billable" if ANY of these are true:
    // 1. Linked to a PO
    // 2. Any line item has a qb_product_mapping_id
    // 3. The expense category is labor-related
    // 4. The vendor type is 'personnel'
    
    const hasProductMapping = lineItems?.some((item: any) => item.qb_product_mapping_id != null);
    
    // Check vendor type
    const { data: vendorData } = await supabase.from('vendors').select('vendor_type').eq('id', bill.vendor_id).single();
    const isPersonnelVendor = vendorData?.vendor_type === 'personnel';
    
    // Check if any line item has a labor-type category
    const laborCategoryNames = ['contract labor', 'subcontract', 'labor', 'temp labor'];
    const hasLaborCategory = lineItems?.some((item: any) => {
      const catName = (categoryMap.get(item.category_id) || '').toLowerCase();
      return laborCategoryNames.some((l: string) => catName.includes(l));
    });
    
    const isBillable = !!bill.purchase_order_id || hasProductMapping || hasLaborCategory || isPersonnelVendor;
    // (regTimeQBItemId and otQBItemId resolved below for billable lines)

    // All bill lines are set to NotBillable - no customer resolution needed
    
    console.log(`isBillable determination: PO=${!!bill.purchase_order_id}, hasProductMapping=${hasProductMapping}, hasLaborCategory=${hasLaborCategory}, isPersonnelVendor=${isPersonnelVendor} => isBillable=${isBillable}`);
    
    // Helper: resolve or create a QB Service item by exact name, with caching in qb_product_service_mappings
    async function resolveOrCreateQBServiceItem(itemName: string): Promise<string | null> {
      const { data: cachedMapping } = await supabase
        .from('qb_product_service_mappings')
        .select('id, quickbooks_item_id')
        .eq('name', itemName)
        .eq('is_active', true)
        .maybeSingle();
      
      if (cachedMapping?.quickbooks_item_id) {
        console.log(`Found cached QB Item for "${itemName}": ${cachedMapping.quickbooks_item_id}`);
        return cachedMapping.quickbooks_item_id;
      }

      try {
        const searchQuery = encodeURIComponent(
          `SELECT * FROM Item WHERE Name = '${itemName.replace(/'/g, "\\'")}' AND Type = 'Service'`
        );
        const searchResult = await qbRequest('GET', `/query?query=${searchQuery}&minorversion=65`, accessToken, realmId);
        if (searchResult.QueryResponse?.Item?.length > 0) {
          const foundItem = searchResult.QueryResponse.Item[0];
          console.log(`Found QB Item "${itemName}" in QuickBooks: ID ${foundItem.Id}`);
          if (cachedMapping) {
            await supabase.from('qb_product_service_mappings').update({ quickbooks_item_id: foundItem.Id }).eq('id', cachedMapping.id);
          } else {
            await supabase.from('qb_product_service_mappings').insert({ name: itemName, quickbooks_item_id: foundItem.Id, quickbooks_item_type: 'Service', is_active: true });
          }
          return foundItem.Id;
        }
      } catch (e) {
        console.log(`Search for QB Item "${itemName}" failed: ${e}`);
      }

      try {
        console.log(`Creating QB Service Item: "${itemName}"...`);
        const incomeQuery = encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Income' MAXRESULTS 1");
        const incomeResult = await qbRequest('GET', `/query?query=${incomeQuery}&minorversion=65`, accessToken, realmId);
        const incomeAccountId = incomeResult.QueryResponse?.Account?.[0]?.Id;
        
        const expQuery = encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Cost of Goods Sold' MAXRESULTS 1");
        const expResult = await qbRequest('GET', `/query?query=${expQuery}&minorversion=65`, accessToken, realmId);
        let expenseAccountId = expResult.QueryResponse?.Account?.[0]?.Id;
        if (!expenseAccountId) {
          const expQuery2 = encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Expense' MAXRESULTS 1");
          const expResult2 = await qbRequest('GET', `/query?query=${expQuery2}&minorversion=65`, accessToken, realmId);
          expenseAccountId = expResult2.QueryResponse?.Account?.[0]?.Id;
        }
        
        const newItem: any = { Name: itemName, Type: 'Service' };
        if (incomeAccountId) newItem.IncomeAccountRef = { value: incomeAccountId };
        if (expenseAccountId) newItem.ExpenseAccountRef = { value: expenseAccountId };
        
        const createResult = await qbRequest('POST', '/item?minorversion=65', accessToken, realmId, newItem);
        const newId = createResult.Item.Id;
        console.log(`Created QB Service Item "${itemName}": ID ${newId}`);
        if (cachedMapping) {
          await supabase.from('qb_product_service_mappings').update({ quickbooks_item_id: newId }).eq('id', cachedMapping.id);
        } else {
          await supabase.from('qb_product_service_mappings').insert({ name: itemName, quickbooks_item_id: newId, quickbooks_item_type: 'Service', is_active: true });
        }
        return newId;
      } catch (createErr) {
        console.error(`Failed to create QB Service Item "${itemName}":`, createErr);
        return null;
      }
    }

    let regTimeQBItemId: string | null = null;
    let otQBItemId: string | null = null;

    if (isBillable) {
      console.log(`Bill is billable - resolving Temp Labor items...`);
      regTimeQBItemId = await resolveOrCreateQBServiceItem('Temp Labor - Reg Time');
      otQBItemId = await resolveOrCreateQBServiceItem('Temp Labor - OT');
      console.log(`Resolved QB Items: RegTime=${regTimeQBItemId}, OT=${otQBItemId}`);
      
      if (!regTimeQBItemId && !otQBItemId) {
        regTimeQBItemId = await resolveOrCreateQBServiceItem('Subcontract Labor');
        otQBItemId = regTimeQBItemId;
      }
    }

    // Build updated QuickBooks bill line items
    const qbLineItems = [];

    if (lineItems && lineItems.length > 0) {
      for (const item of lineItems) {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unit_cost) || Number(item.total);
        const desc = `${item.description} - ${qty} x $${unitPrice.toFixed(2)}`;
        
        // For billable bills, use Item Details with per-line QB Item (reg/OT)
        if (isBillable && (regTimeQBItemId || otQBItemId)) {
          const specificProduct = item.qb_product_mapping_id ? qbProductMap.get(item.qb_product_mapping_id) : null;
          
          let itemId: string;
          if (specificProduct?.qb_item_id) {
            itemId = specificProduct.qb_item_id;
          } else {
            const descLower = (item.description || '').toLowerCase();
            if (descLower.includes('overtime hours') && otQBItemId) {
              itemId = otQBItemId;
            } else {
              itemId = regTimeQBItemId || otQBItemId!;
            }
          }
          
          console.log(`Line item "${desc}" -> Amount: ${item.total} -> QB Item ID: ${itemId} [BILLABLE - Item Details]`);
          
          qbLineItems.push({
            DetailType: 'ItemBasedExpenseLineDetail',
            Amount: Number(item.total),
            Description: desc,
            ItemBasedExpenseLineDetail: {
              ItemRef: { value: itemId },
              Qty: qty,
              UnitPrice: unitPrice,
              BillableStatus: 'NotBillable',
            },
          });
        } else {
          // Non-PO bills: Use AccountBasedExpenseLineDetail (Category Details)
          const categoryName = item.category_id ? categoryMap.get(item.category_id) || null : null;
          const expenseAccountRef = await getExpenseAccountRef(categoryName, accessToken, realmId);
          
          console.log(`Line item "${desc}" -> Amount: ${item.total} -> QB Account: ${expenseAccountRef.name} [Category Details]`);
          
          qbLineItems.push({
            DetailType: 'AccountBasedExpenseLineDetail',
            Amount: Number(item.total),
            Description: desc,
            AccountBasedExpenseLineDetail: {
              AccountRef: expenseAccountRef,
              BillableStatus: 'NotBillable',
            },
          });
        }
      }
    } else {
      const defaultAccountRef = await getExpenseAccountRef(null, accessToken, realmId);
      qbLineItems.push({
        DetailType: 'AccountBasedExpenseLineDetail',
        Amount: Number(bill.subtotal),
        Description: `Bill ${bill.number}`,
        AccountBasedExpenseLineDetail: {
          AccountRef: defaultAccountRef,
          BillableStatus: 'NotBillable',
        },
      });
    }

    // Filter out any zero-amount line items to prevent empty category entries
    const filteredLineItems = qbLineItems.filter((line: any) => line.Amount > 0);
    console.log(`Filtered line items: ${qbLineItems.length} -> ${filteredLineItems.length} (removed ${qbLineItems.length - filteredLineItems.length} zero-amount lines)`);

    // QB's Bill update replaces ALL lines when the Line array is provided.
    // No need to include old ItemBasedExpenseLineDetail lines - they are automatically removed.
    const qbBill: any = {
      sparse: false, // Force full update to remove old Item Detail lines
      Id: qbBillId,
      SyncToken: syncToken,
      VendorRef: { value: qbVendorId },
      Line: filteredLineItems,
      TxnDate: bill.bill_date,
      DueDate: bill.due_date,
      DocNumber: bill.number,
      PrivateNote: bill.notes || `CommandX Vendor Bill: ${bill.number}`,
    };

    console.log("Updating bill in QuickBooks:", JSON.stringify(qbBill, null, 2));

    // IMPORTANT: Update last_synced_at BEFORE sending to QB to prevent webhook race condition
    // When QB receives our update, it immediately fires a webhook back. If we update last_synced_at
    // after the QB call, the webhook might arrive first and overwrite local changes with stale QB data.
    const syncTimestamp = new Date().toISOString();
    await supabase
      .from("quickbooks_bill_mappings")
      .update({
        last_synced_at: syncTimestamp,
        sync_status: "syncing",
        updated_at: syncTimestamp,
      })
      .eq("bill_id", billId);

    const result = await qbRequest(
      "POST",
      "/bill?minorversion=65",
      accessToken,
      realmId,
      qbBill
    );

    console.log("QuickBooks bill updated:", result.Bill.Id);

    // Update mapping status to synced after successful QB update
    await supabase
      .from("quickbooks_bill_mappings")
      .update({
        sync_status: "synced",
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
