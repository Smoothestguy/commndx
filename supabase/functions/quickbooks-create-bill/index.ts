import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateLockedPeriod } from "../_shared/lockedPeriodValidator.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Authentication helper - validates user and checks admin/manager role
async function authenticateRequest(
  req: Request
): Promise<
  { userId: string; error?: never } | { userId?: never; error: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("No authorization header provided");
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser(token);
  if (userError || !user) {
    console.error("User authentication failed:", userError);
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
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

  if (!roleData || !["admin", "manager"].includes(roleData.role)) {
    console.error("User does not have admin/manager role:", user.id);
    return {
      error: new Response(
        JSON.stringify({
          error:
            "Insufficient permissions. Only admins and managers can access QuickBooks functions.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      ),
    };
  }

  console.log(`Authenticated user ${user.id} with role ${roleData.role}`);
  return { userId: user.id };
}

// Helper to get valid access token
async function getValidToken(supabase: any) {
  const { data: config, error } = await supabase
    .from("quickbooks_config")
    .select("*")
    .eq("is_connected", true)
    .single();

  if (error || !config) {
    throw new Error("QuickBooks not connected");
  }

  const tokenExpires = new Date(config.token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (tokenExpires < fiveMinutesFromNow) {
    console.log("Token expiring soon, refreshing...");
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/quickbooks-oauth`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ action: "refresh-token" }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to refresh token");
    }

    const { access_token, realm_id } = await response.json();
    return { accessToken: access_token, realmId: realm_id };
  }

  return { accessToken: config.access_token, realmId: config.realm_id };
}

// QuickBooks API helper
async function qbRequest(
  method: string,
  endpoint: string,
  accessToken: string,
  realmId: string,
  body?: any
) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}${endpoint}`;

  console.log(`QuickBooks API ${method} ${endpoint}`);

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
    throw new Error(`QuickBooks API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Get or create vendor in QuickBooks
async function getOrCreateQBVendor(
  supabase: any,
  vendorId: string,
  accessToken: string,
  realmId: string
): Promise<string> {
  // Check if vendor already mapped
  const { data: mapping } = await supabase
    .from("quickbooks_vendor_mappings")
    .select("quickbooks_vendor_id")
    .eq("vendor_id", vendorId)
    .single();

  if (mapping) {
    console.log(
      `Found existing vendor mapping: ${mapping.quickbooks_vendor_id}`
    );
    return mapping.quickbooks_vendor_id;
  }

  // Get vendor details
  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", vendorId)
    .single();

  if (vendorError || !vendor) {
    throw new Error(`Vendor not found: ${vendorId}`);
  }

  // Normalize vendor name (trim whitespace)
  const normalizedName = vendor.name.trim();
  console.log(`Searching QuickBooks for existing vendor: "${normalizedName}"`);

  try {
    const searchQuery = encodeURIComponent(
      `SELECT * FROM Vendor WHERE DisplayName = '${normalizedName.replace(
        /'/g,
        "\\'"
      )}'`
    );
    const searchResult = await qbRequest(
      "GET",
      `/query?query=${searchQuery}&minorversion=65`,
      accessToken,
      realmId
    );

    if (searchResult.QueryResponse?.Vendor?.length > 0) {
      const existingVendor = searchResult.QueryResponse.Vendor[0];
      console.log(
        `Found existing QuickBooks vendor: ${existingVendor.DisplayName} (ID: ${existingVendor.Id})`
      );

      // Create mapping for existing vendor
      await supabase.from("quickbooks_vendor_mappings").insert({
        vendor_id: vendorId,
        quickbooks_vendor_id: existingVendor.Id,
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
        sync_direction: "export",
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
    BillAddr: vendor.address
      ? {
          Line1: vendor.address,
        }
      : undefined,
    Active: vendor.status === "active",
  };

  try {
    const result = await qbRequest(
      "POST",
      "/vendor?minorversion=65",
      accessToken,
      realmId,
      qbVendor
    );
    const qbVendorId = result.Vendor.Id;

    // Create mapping
    await supabase.from("quickbooks_vendor_mappings").insert({
      vendor_id: vendorId,
      quickbooks_vendor_id: qbVendorId,
      sync_status: "synced",
      last_synced_at: new Date().toISOString(),
      sync_direction: "export",
    });

    console.log(`Created vendor in QuickBooks with ID: ${qbVendorId}`);
    return qbVendorId;
  } catch (createError: any) {
    // Handle duplicate name error - extract ID from error message first
    if (
      createError.message?.includes("Duplicate Name Exists") ||
      createError.message?.includes("6240")
    ) {
      console.log(
        `Duplicate name error detected, attempting to extract ID from error...`
      );

      // Extract ID from error message: "The name supplied already exists. : Id=1209"
      const idMatch = createError.message.match(/Id=(\d+)/);
      if (idMatch) {
        const existingVendorId = idMatch[1];
        console.log(
          `Extracted existing vendor ID from error: ${existingVendorId}`
        );

        // Create mapping directly using the extracted ID
        await supabase.from("quickbooks_vendor_mappings").insert({
          vendor_id: vendorId,
          quickbooks_vendor_id: existingVendorId,
          sync_status: "synced",
          last_synced_at: new Date().toISOString(),
          sync_direction: "export",
        });

        return existingVendorId;
      }

      // Fallback: search with LIKE query using normalized name
      console.log(`ID not in error message, searching with LIKE query...`);
      const likeQuery = encodeURIComponent(
        `SELECT * FROM Vendor WHERE DisplayName LIKE '%${normalizedName.replace(
          /'/g,
          "\\'"
        )}%' MAXRESULTS 10`
      );
      const likeResult = await qbRequest(
        "GET",
        `/query?query=${likeQuery}&minorversion=65`,
        accessToken,
        realmId
      );

      if (likeResult.QueryResponse?.Vendor?.length > 0) {
        // Find best match (exact or closest) using normalized comparison
        const exactMatch = likeResult.QueryResponse.Vendor.find(
          (v: any) =>
            v.DisplayName.trim().toLowerCase() === normalizedName.toLowerCase()
        );
        const matchedVendor = exactMatch || likeResult.QueryResponse.Vendor[0];

        console.log(
          `Found matching vendor after duplicate error: ${matchedVendor.DisplayName} (ID: ${matchedVendor.Id})`
        );

        await supabase.from("quickbooks_vendor_mappings").insert({
          vendor_id: vendorId,
          quickbooks_vendor_id: matchedVendor.Id,
          sync_status: "synced",
          last_synced_at: new Date().toISOString(),
          sync_direction: "export",
        });

        return matchedVendor.Id;
      }
    }

    throw createError;
  }
}

// Cache for QuickBooks accounts to avoid repeated API calls
const accountCache: Map<string, { value: string; name: string }> = new Map();

// Valid account types for expense accounts
const VALID_EXPENSE_ACCOUNT_TYPES = [
  "Expense",
  "Cost of Goods Sold",
  "Other Current Liability",
];

// Upload attachment to QuickBooks
async function uploadAttachmentToQB(
  supabase: any,
  attachment: { file_name: string; file_path: string; file_type: string },
  qbBillId: string,
  accessToken: string,
  realmId: string
): Promise<{ success: boolean; attachableId?: string; error?: string }> {
  try {
    console.log(`Downloading attachment from storage: ${attachment.file_path}`);

    // Download file from Supabase storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("document-attachments")
      .download(attachment.file_path);

    if (downloadError || !fileData) {
      throw new Error(
        `Failed to download file: ${attachment.file_name} - ${
          downloadError?.message || "No data"
        }`
      );
    }

    // Create multipart form data
    const boundary = `----FormBoundary${Date.now()}`;

    const metadata = JSON.stringify({
      AttachableRef: [
        {
          EntityRef: {
            type: "Bill",
            value: qbBillId,
          },
        },
      ],
      FileName: attachment.file_name,
      ContentType: attachment.file_type,
    });

    // Convert blob to array buffer for multipart
    const fileBuffer = await fileData.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    // Build multipart body
    const encoder = new TextEncoder();
    const parts = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file_metadata_01"\r\n`,
      `Content-Type: application/json\r\n\r\n`,
      metadata,
      `\r\n--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file_content_01"; filename="${attachment.file_name}"\r\n`,
      `Content-Type: ${attachment.file_type}\r\n\r\n`,
    ];

    const preamble = encoder.encode(parts.join(""));
    const postamble = encoder.encode(`\r\n--${boundary}--\r\n`);

    // Combine all parts
    const body = new Uint8Array(
      preamble.length + fileBytes.length + postamble.length
    );
    body.set(preamble, 0);
    body.set(fileBytes, preamble.length);
    body.set(postamble, preamble.length + fileBytes.length);

    // Upload to QuickBooks
    const uploadUrl = `https://quickbooks.api.intuit.com/v3/company/${realmId}/upload?minorversion=65`;

    console.log(
      `Uploading attachment "${attachment.file_name}" to QuickBooks...`
    );

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Accept: "application/json",
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `QuickBooks upload failed (${response.status}): ${errorText}`
      );
    }

    const result = await response.json();
    const attachableId = result.AttachableResponse?.[0]?.Attachable?.Id;

    console.log(
      `Successfully uploaded attachment "${attachment.file_name}" to QuickBooks: ${attachableId}`
    );
    return { success: true, attachableId };
  } catch (error: any) {
    console.error(
      `Attachment upload error for "${attachment.file_name}": ${error.message}`
    );
    return { success: false, error: error.message };
  }
}

// Get expense account reference - tries to match by category name first
async function getExpenseAccountRef(
  categoryName: string | null,
  accessToken: string,
  realmId: string
): Promise<{ value: string; name: string }> {
  // If we have a category name, try to find a matching account
  if (categoryName) {
    // Check cache first
    const cacheKey = categoryName.toLowerCase();
    if (accountCache.has(cacheKey)) {
      console.log(`Using cached account for category: ${categoryName}`);
      return accountCache.get(cacheKey)!;
    }

    console.log(
      `Searching QuickBooks for account matching category: ${categoryName}`
    );

    // Search for accounts by name only (QuickBooks doesn't support OR in WHERE clause)
    // We'll filter by account type in code
    const searchQuery = encodeURIComponent(
      `SELECT * FROM Account WHERE Name LIKE '%${categoryName}%' MAXRESULTS 50`
    );

    try {
      const result = await qbRequest(
        "GET",
        `/query?query=${searchQuery}&minorversion=65`,
        accessToken,
        realmId
      );

      if (result.QueryResponse?.Account?.length > 0) {
        // Filter to only include valid expense account types
        const validAccounts = result.QueryResponse.Account.filter((acc: any) =>
          VALID_EXPENSE_ACCOUNT_TYPES.includes(acc.AccountType)
        );

        if (validAccounts.length > 0) {
          // Try to find exact match first
          const exactMatch = validAccounts.find(
            (acc: any) => acc.Name.toLowerCase() === categoryName.toLowerCase()
          );

          if (exactMatch) {
            const accountRef = { value: exactMatch.Id, name: exactMatch.Name };
            accountCache.set(cacheKey, accountRef);
            console.log(
              `Found exact match account: ${exactMatch.Name} (${exactMatch.Id}) [Type: ${exactMatch.AccountType}]`
            );
            return accountRef;
          }

          // Otherwise use the first partial match
          const account = validAccounts[0];
          const accountRef = { value: account.Id, name: account.Name };
          accountCache.set(cacheKey, accountRef);
          console.log(
            `Found partial match account: ${account.Name} (${account.Id}) [Type: ${account.AccountType}] for category: ${categoryName}`
          );
          return accountRef;
        }

        console.log(
          `Found ${result.QueryResponse.Account.length} accounts matching "${categoryName}" but none are valid expense types`
        );
      }

      console.log(
        `No matching account found for category: ${categoryName}, will use default`
      );
    } catch (e) {
      console.log(
        `Error searching for category account: ${e}, will use default`
      );
    }
  }

  // Check cache for default account
  if (accountCache.has("__default__")) {
    return accountCache.get("__default__")!;
  }

  // Fallback: Query for a Cost of Goods Sold account
  const cogsQuery = encodeURIComponent(
    "SELECT * FROM Account WHERE AccountType = 'Cost of Goods Sold' MAXRESULTS 1"
  );

  try {
    const result = await qbRequest(
      "GET",
      `/query?query=${cogsQuery}&minorversion=65`,
      accessToken,
      realmId
    );

    if (result.QueryResponse?.Account?.length > 0) {
      const account = result.QueryResponse.Account[0];
      const accountRef = { value: account.Id, name: account.Name };
      accountCache.set("__default__", accountRef);
      console.log(
        `Using default COGS account: ${account.Name} (${account.Id})`
      );
      return accountRef;
    }
  } catch (e) {
    console.log("Could not find COGS account, trying Expense account");
  }

  // Final fallback to expense account
  const expenseQuery = encodeURIComponent(
    "SELECT * FROM Account WHERE AccountType = 'Expense' MAXRESULTS 1"
  );
  const expenseResult = await qbRequest(
    "GET",
    `/query?query=${expenseQuery}&minorversion=65`,
    accessToken,
    realmId
  );

  if (expenseResult.QueryResponse?.Account?.length > 0) {
    const account = expenseResult.QueryResponse.Account[0];
    const accountRef = { value: account.Id, name: account.Name };
    accountCache.set("__default__", accountRef);
    console.log(
      `Using default Expense account: ${account.Name} (${account.Id})`
    );
    return accountRef;
  }

  throw new Error("No expense account found in QuickBooks");
}

serve(async (req) => {
  // Clear caches for each request to ensure fresh data
  accountCache.clear();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if (authResult.error) {
      return authResult.error;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { billId } = await req.json();

    if (!billId) {
      throw new Error("billId is required");
    }

    console.log(
      `Creating QuickBooks bill for bill ID: ${billId}, by user: ${authResult.userId}`
    );

    const { accessToken, realmId } = await getValidToken(supabase);

    // Get the vendor bill with line items
    const { data: bill, error: billError } = await supabase
      .from("vendor_bills")
      .select("*")
      .eq("id", billId)
      .single();

    if (billError || !bill) {
      throw new Error(`Vendor bill not found: ${billId}`);
    }

    // Validate locked period BEFORE syncing to QuickBooks
    const periodCheck = await validateLockedPeriod(
      supabase,
      bill.bill_date,
      "vendor_bill",
      billId,
      authResult.userId,
      "create"
    );

    if (!periodCheck.allowed) {
      console.warn("Locked period violation:", periodCheck.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: periodCheck.message,
          blocked_by: "locked_period",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get line items
    const { data: lineItems, error: lineItemsError } = await supabase
      .from("vendor_bill_line_items")
      .select("*")
      .eq("bill_id", billId);

    if (lineItemsError) {
      throw new Error(`Failed to get line items: ${lineItemsError.message}`);
    }

    console.log(
      `Found ${lineItems?.length || 0} line items for bill ${bill.number}`
    );

    // Resolve vendor in QuickBooks
    const qbVendorId = await getOrCreateQBVendor(
      supabase,
      bill.vendor_id,
      accessToken,
      realmId
    );
    console.log(`Resolved QB Vendor ID: ${qbVendorId}`);

    // Check for existing bill mapping
    const { data: existingMapping } = await supabase
      .from("quickbooks_bill_mappings")
      .select("*")
      .eq("bill_id", billId)
      .maybeSingle();

    // Build a map of category IDs to category names
    const categoryMap: Map<string, string> = new Map();
    if (lineItems && lineItems.length > 0) {
      const categoryIds = lineItems
        .map((item: any) => item.category_id)
        .filter((id: string | null) => id !== null);

      if (categoryIds.length > 0) {
        const { data: categories } = await supabase
          .from("expense_categories")
          .select("id, name")
          .in("id", categoryIds);

        if (categories) {
          for (const cat of categories) {
            categoryMap.set(cat.id, cat.name);
          }
          console.log(
            `Loaded ${categories.length} expense categories for mapping`
          );
        }
      }
    }

    // Fetch QB product mappings for line items that have them
    const qbProductMap = new Map();
    if (lineItems && lineItems.length > 0) {
      const qbMappingIds = lineItems
        .map((item: any) => item.qb_product_mapping_id)
        .filter((id: string | null) => id !== null);

      if (qbMappingIds.length > 0) {
        const { data: mappings } = await supabase
          .from("qb_product_service_mappings")
          .select("id, name, quickbooks_item_id")
          .in("id", qbMappingIds);

        if (mappings) {
          for (const m of mappings) {
            if (m.quickbooks_item_id) {
              qbProductMap.set(m.id, {
                qb_item_id: m.quickbooks_item_id,
                name: m.name,
              });
            }
          }
        }
        console.log(
          `Loaded ${qbProductMap.size} QB product mappings for billable items`
        );
      }
    }

    // AUTO-RESOLVE: Determine if bill should use Item Details (billable) or Category Details
    // A bill is "billable" if ANY of these are true:
    // 1. Linked to a PO
    // 2. Any line item has a qb_product_mapping_id
    // 3. The expense category is labor-related
    // 4. The vendor type is 'personnel'

    const hasProductMapping = lineItems?.some(
      (item: any) => item.qb_product_mapping_id != null
    );

    // Check vendor type
    const { data: vendorData } = await supabase
      .from("vendors")
      .select("vendor_type")
      .eq("id", bill.vendor_id)
      .single();
    const isPersonnelVendor = vendorData?.vendor_type === "personnel";

    // Only use Item Details when there's a PO link or explicit product mapping
    // Labor categories should use Category Details (expense accounts), NOT Item Details
    const isBillable = !!bill.purchase_order_id || hasProductMapping;
    // (regTimeQBItemId and otQBItemId resolved below for billable lines)

    // All bill lines are set to NotBillable - no customer resolution needed

    console.log(
      `isBillable determination: PO=${!!bill.purchase_order_id}, hasProductMapping=${hasProductMapping} => isBillable=${isBillable}`
    );

    // Helper: resolve or create a QB Service item by exact name, with caching in qb_product_service_mappings
    async function resolveOrCreateQBServiceItem(
      itemName: string
    ): Promise<string | null> {
      // Step 1: Check cached mapping by name
      const { data: cachedMapping } = await supabase
        .from("qb_product_service_mappings")
        .select("id, quickbooks_item_id")
        .eq("name", itemName)
        .eq("is_active", true)
        .maybeSingle();

      if (cachedMapping?.quickbooks_item_id) {
        console.log(
          `Found cached QB Item for "${itemName}": ${cachedMapping.quickbooks_item_id}`
        );
        return cachedMapping.quickbooks_item_id;
      }

      // Step 2: Search QuickBooks by exact name
      try {
        const searchQuery = encodeURIComponent(
          `SELECT * FROM Item WHERE Name = '${itemName.replace(
            /'/g,
            "\\'"
          )}' AND Type = 'Service'`
        );
        const searchResult = await qbRequest(
          "GET",
          `/query?query=${searchQuery}&minorversion=65`,
          accessToken,
          realmId
        );
        if (searchResult.QueryResponse?.Item?.length > 0) {
          const foundItem = searchResult.QueryResponse.Item[0];
          console.log(
            `Found QB Item "${itemName}" in QuickBooks: ID ${foundItem.Id}`
          );
          // Cache it
          if (cachedMapping) {
            await supabase
              .from("qb_product_service_mappings")
              .update({ quickbooks_item_id: foundItem.Id })
              .eq("id", cachedMapping.id);
          } else {
            await supabase
              .from("qb_product_service_mappings")
              .insert({
                name: itemName,
                quickbooks_item_id: foundItem.Id,
                quickbooks_item_type: "Service",
                is_active: true,
              });
          }
          return foundItem.Id;
        }
      } catch (e) {
        console.log(`Search for QB Item "${itemName}" failed: ${e}`);
      }

      // Step 3: Create it in QuickBooks
      try {
        console.log(`Creating QB Service Item: "${itemName}"...`);
        const incomeQuery = encodeURIComponent(
          "SELECT * FROM Account WHERE AccountType = 'Income' MAXRESULTS 1"
        );
        const incomeResult = await qbRequest(
          "GET",
          `/query?query=${incomeQuery}&minorversion=65`,
          accessToken,
          realmId
        );
        const incomeAccountId = incomeResult.QueryResponse?.Account?.[0]?.Id;

        const expQuery = encodeURIComponent(
          "SELECT * FROM Account WHERE AccountType = 'Cost of Goods Sold' MAXRESULTS 1"
        );
        const expResult = await qbRequest(
          "GET",
          `/query?query=${expQuery}&minorversion=65`,
          accessToken,
          realmId
        );
        let expenseAccountId = expResult.QueryResponse?.Account?.[0]?.Id;
        if (!expenseAccountId) {
          const expQuery2 = encodeURIComponent(
            "SELECT * FROM Account WHERE AccountType = 'Expense' MAXRESULTS 1"
          );
          const expResult2 = await qbRequest(
            "GET",
            `/query?query=${expQuery2}&minorversion=65`,
            accessToken,
            realmId
          );
          expenseAccountId = expResult2.QueryResponse?.Account?.[0]?.Id;
        }

        const newItem: any = { Name: itemName, Type: "Service" };
        if (incomeAccountId)
          newItem.IncomeAccountRef = { value: incomeAccountId };
        if (expenseAccountId)
          newItem.ExpenseAccountRef = { value: expenseAccountId };

        const createResult = await qbRequest(
          "POST",
          "/item?minorversion=65",
          accessToken,
          realmId,
          newItem
        );
        const newId = createResult.Item.Id;
        console.log(`Created QB Service Item "${itemName}": ID ${newId}`);
        // Cache it
        if (cachedMapping) {
          await supabase
            .from("qb_product_service_mappings")
            .update({ quickbooks_item_id: newId })
            .eq("id", cachedMapping.id);
        } else {
          await supabase
            .from("qb_product_service_mappings")
            .insert({
              name: itemName,
              quickbooks_item_id: newId,
              quickbooks_item_type: "Service",
              is_active: true,
            });
        }
        return newId;
      } catch (createErr) {
        console.error(
          `Failed to create QB Service Item "${itemName}":`,
          createErr
        );
        return null;
      }
    }

    // Resolve dual QB Items for labor: Reg Time and OT
    let regTimeQBItemId: string | null = null;
    let otQBItemId: string | null = null;

    if (isBillable) {
      console.log(`Bill is billable - resolving Temp Labor items...`);
      regTimeQBItemId = await resolveOrCreateQBServiceItem(
        "Temp Labor - Reg Time"
      );
      otQBItemId = await resolveOrCreateQBServiceItem("Temp Labor - OT");
      console.log(
        `Resolved QB Items: RegTime=${regTimeQBItemId}, OT=${otQBItemId}`
      );

      // Fallback: if neither resolved, try generic resolution
      if (!regTimeQBItemId && !otQBItemId) {
        regTimeQBItemId = await resolveOrCreateQBServiceItem(
          "Subcontract Labor"
        );
        otQBItemId = regTimeQBItemId; // Use same as fallback
      }
    }

    // Build QB bill line items with category-based account mapping
    const qbLineItems = [];

    if (lineItems && lineItems.length > 0) {
      for (const item of lineItems) {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unit_cost) || Number(item.total);
        const desc = `${item.description} - ${qty} x $${unitPrice.toFixed(2)}`;

        // For billable bills, use Item Details with per-line QB Item (reg/OT)
        if (isBillable && (regTimeQBItemId || otQBItemId)) {
          // Check if this specific line item has its own mapping first (takes priority)
          const specificProduct = item.qb_product_mapping_id
            ? qbProductMap.get(item.qb_product_mapping_id)
            : null;

          let itemId: string;
          if (specificProduct?.qb_item_id) {
            itemId = specificProduct.qb_item_id;
          } else {
            // Auto-detect reg/OT based on description
            const descLower = (item.description || "").toLowerCase();
            if (descLower.includes("overtime hours") && otQBItemId) {
              itemId = otQBItemId;
            } else {
              itemId = regTimeQBItemId || otQBItemId!;
            }
          }

          console.log(
            `Line item "${desc}" -> Amount: ${item.total} -> QB Item ID: ${itemId} [BILLABLE - Item Details]`
          );

          qbLineItems.push({
            DetailType: "ItemBasedExpenseLineDetail",
            Amount: Number(item.total),
            Description: desc,
            ItemBasedExpenseLineDetail: {
              ItemRef: { value: itemId },
              Qty: qty,
              UnitPrice: unitPrice,
              BillableStatus: "NotBillable",
            },
          });
        } else {
          // Non-PO bills OR fallback: Use AccountBasedExpenseLineDetail (Category Details)
          const categoryName = item.category_id
            ? categoryMap.get(item.category_id) || null
            : null;
          const expenseAccountRef = await getExpenseAccountRef(
            categoryName,
            accessToken,
            realmId
          );

          console.log(
            `Line item "${desc}" -> Amount: ${item.total} -> QB Account: ${expenseAccountRef.name} [Category Details]`
          );

          qbLineItems.push({
            DetailType: "AccountBasedExpenseLineDetail",
            Amount: Number(item.total),
            Description: desc,
            AccountBasedExpenseLineDetail: {
              AccountRef: expenseAccountRef,
              BillableStatus: "NotBillable",
            },
          });
        }
      }
    } else {
      // If no line items, create one with the total using default account
      const defaultAccountRef = await getExpenseAccountRef(
        null,
        accessToken,
        realmId
      );
      qbLineItems.push({
        DetailType: "AccountBasedExpenseLineDetail",
        Amount: Number(bill.subtotal),
        Description: `Bill ${bill.number}`,
        AccountBasedExpenseLineDetail: {
          AccountRef: defaultAccountRef,
          BillableStatus: "NotBillable",
        },
      });
    }

    // Create QB bill
    // Filter out any zero-amount line items to prevent empty category entries
    const filteredLineItems = qbLineItems.filter(
      (line: any) => line.Amount > 0
    );
    console.log(
      `Filtered line items: ${qbLineItems.length} -> ${
        filteredLineItems.length
      } (removed ${
        qbLineItems.length - filteredLineItems.length
      } zero-amount lines)`
    );

    const qbBill = {
      VendorRef: { value: qbVendorId },
      Line: filteredLineItems,
      TxnDate: bill.bill_date,
      DueDate: bill.due_date,
      DocNumber: bill.number,
      PrivateNote: bill.notes || `CommandX Vendor Bill: ${bill.number}`,
    };

    console.log(
      "Creating bill in QuickBooks:",
      JSON.stringify(qbBill, null, 2)
    );

    const result = await qbRequest(
      "POST",
      "/bill?minorversion=65",
      accessToken,
      realmId,
      qbBill
    );

    const qbBillId = result.Bill.Id;
    const qbDocNumber = result.Bill.DocNumber;

    console.log(
      `Bill created in QuickBooks with ID: ${qbBillId}, DocNumber: ${qbDocNumber}`
    );

    // Create or update mapping
    if (existingMapping) {
      await supabase
        .from("quickbooks_bill_mappings")
        .update({
          quickbooks_bill_id: qbBillId,
          quickbooks_doc_number: qbDocNumber,
          sync_status: "synced",
          last_synced_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", existingMapping.id);
    } else {
      await supabase.from("quickbooks_bill_mappings").insert({
        bill_id: billId,
        quickbooks_bill_id: qbBillId,
        quickbooks_doc_number: qbDocNumber,
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
      });
    }

    // Log the sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "vendor_bill",
      entity_id: billId,
      quickbooks_id: qbBillId,
      action: "create",
      status: "success",
      details: { doc_number: qbDocNumber, vendor_name: bill.vendor_name },
    });

    // Fetch and upload attachments
    let attachmentsSynced = 0;
    let attachmentsFailed = 0;

    console.log(`[QB-SYNC] Querying attachments for bill ID: ${billId}`);

    const { data: attachments, error: attachmentError } = await supabase
      .from("vendor_bill_attachments")
      .select("*")
      .eq("bill_id", billId);

    if (attachmentError) {
      console.error(`[QB-SYNC] Error fetching attachments:`, attachmentError);
    }

    console.log(
      `[QB-SYNC] Found ${
        attachments?.length || 0
      } attachments for bill ${billId}`
    );

    if (attachments && attachments.length > 0) {
      console.log(
        `[QB-SYNC] Attachment details:`,
        attachments.map((a) => ({ id: a.id, file_name: a.file_name }))
      );
      console.log(
        `[QB-SYNC] Uploading ${attachments.length} attachments to QuickBooks...`
      );

      for (const attachment of attachments) {
        const result = await uploadAttachmentToQB(
          supabase,
          attachment,
          qbBillId,
          accessToken,
          realmId
        );

        if (result.success) {
          attachmentsSynced++;
        } else {
          attachmentsFailed++;
          console.warn(
            `[QB-SYNC] Failed to upload attachment: ${attachment.file_name} - ${result.error}`
          );
        }
      }

      console.log(
        `[QB-SYNC] Attachments sync complete: ${attachmentsSynced} success, ${attachmentsFailed} failed`
      );
    } else {
      console.log(`[QB-SYNC] No attachments found to sync for bill ${billId}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        quickbooksBillId: qbBillId,
        quickbooksDocNumber: qbDocNumber,
        attachmentsSynced,
        attachmentsFailed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("QuickBooks bill creation error:", errorMessage);

    // Try to get billId from request for logging
    let billId: string | null = null;
    try {
      const body = await req.clone().json();
      billId = body.billId;
    } catch {}

    // Create service client for error logging
    const serviceSupabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    // Handle duplicate document number error (code 6140) - link to existing QB bill
    if (
      billId &&
      (errorMessage.includes("6140") ||
        errorMessage.includes("Duplicate Document Number"))
    ) {
      const txnIdMatch = errorMessage.match(/TxnId=(\d+)/);
      const docNumberMatch = errorMessage.match(/DocNumber=([^\s]+)/);

      if (txnIdMatch) {
        const existingQbBillId = txnIdMatch[1];
        const existingDocNumber = docNumberMatch ? docNumberMatch[1] : null;
        console.log(
          `Duplicate detected - linking to existing QB Bill: ${existingQbBillId}`
        );

        // Update mapping with the existing QB ID
        await serviceSupabase.from("quickbooks_bill_mappings").upsert(
          {
            bill_id: billId,
            quickbooks_bill_id: existingQbBillId,
            quickbooks_doc_number: existingDocNumber,
            sync_status: "synced",
            last_synced_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "bill_id" }
        );

        // Log the recovery
        await serviceSupabase.from("quickbooks_sync_log").insert({
          entity_type: "vendor_bill",
          entity_id: billId,
          action: "create",
          status: "recovered",
          error_message: `Linked to existing QB Bill ${existingQbBillId} after duplicate error`,
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: "Linked to existing QuickBooks bill",
            quickbooksBillId: existingQbBillId,
            quickbooksDocNumber: existingDocNumber,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Update mapping with error if it exists
    if (billId) {
      await serviceSupabase.from("quickbooks_bill_mappings").upsert(
        {
          bill_id: billId,
          quickbooks_bill_id: "",
          sync_status: "error",
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "bill_id",
        }
      );
    }

    // Log the error
    await serviceSupabase.from("quickbooks_sync_log").insert({
      entity_type: "vendor_bill",
      entity_id: billId,
      action: "create",
      status: "failed",
      error_message: errorMessage,
    });

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
