import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // Check if token is expired or will expire in next 5 minutes
  const tokenExpires = new Date(config.token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (tokenExpires < fiveMinutesFromNow) {
    // Refresh the token
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

// QuickBooks API helper - returns { data, error } format for better error handling
async function qbRequest(method: string, endpoint: string, accessToken: string, realmId: string, body?: any): Promise<any> {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
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

// Helper to find existing QB item by name
async function findQBItemByName(name: string, accessToken: string, realmId: string): Promise<any | null> {
  try {
    // Escape single quotes for QuickBooks query
    const escapedName = name.replace(/'/g, "\\'");
    const query = `SELECT * FROM Item WHERE Name = '${escapedName}'`;
    const result = await qbRequest('GET', `/query?query=${encodeURIComponent(query)}&minorversion=65`, accessToken, realmId);
    return result.QueryResponse?.Item?.[0] || null;
  } catch (error) {
    console.error(`Error querying QB item by name "${name}":`, error);
    return null;
  }
}

// Cache interface for income accounts during sync operation
interface AccountCache {
  serviceIncomeAccountId: string | null;
  productIncomeAccountId: string | null;
  expenseAccountId: string | null;
}

// Helper to get appropriate income accounts from QuickBooks
async function getIncomeAccounts(accessToken: string, realmId: string): Promise<AccountCache> {
  try {
    // Query QuickBooks for Income-type accounts
    const query = "SELECT * FROM Account WHERE AccountType = 'Income' AND Active = true MAXRESULTS 100";
    const result = await qbRequest('GET', `/query?query=${encodeURIComponent(query)}&minorversion=65`, accessToken, realmId);
    
    const accounts = result.QueryResponse?.Account || [];
    
    let serviceIncomeAccountId: string | null = null;
    let productIncomeAccountId: string | null = null;
    
    for (const account of accounts) {
      const name = (account.Name || '').toLowerCase();
      const subType = (account.AccountSubType || '').toLowerCase();
      
      // Look for service income account
      if (!serviceIncomeAccountId && (
        name.includes('service') || 
        subType === 'servicefeesincome' ||
        subType.includes('service')
      )) {
        serviceIncomeAccountId = account.Id;
        console.log(`Found service income account: ${account.Name} (ID: ${account.Id})`);
      }
      
      // Look for product/sales income account
      if (!productIncomeAccountId && (
        name.includes('sales of product') || 
        name.includes('product sales') ||
        name.includes('merchandise') ||
        subType === 'salesofproductincome'
      )) {
        productIncomeAccountId = account.Id;
        console.log(`Found product income account: ${account.Name} (ID: ${account.Id})`);
      }
    }
    
    // If no specific accounts found, use the first income account as fallback
    if (!serviceIncomeAccountId && !productIncomeAccountId && accounts.length > 0) {
      const fallbackAccount = accounts[0];
      serviceIncomeAccountId = fallbackAccount.Id;
      productIncomeAccountId = fallbackAccount.Id;
      console.log(`Using fallback income account: ${fallbackAccount.Name} (ID: ${fallbackAccount.Id})`);
    }
    
    // Get expense account (Cost of Goods Sold)
    let expenseAccountId: string | null = null;
    try {
      const expenseQuery = "SELECT * FROM Account WHERE AccountType IN ('Cost of Goods Sold', 'Expense') AND Active = true MAXRESULTS 50";
      const expenseResult = await qbRequest('GET', `/query?query=${encodeURIComponent(expenseQuery)}&minorversion=65`, accessToken, realmId);
      
      const expenseAccounts = expenseResult.QueryResponse?.Account || [];
      const cogsAccount = expenseAccounts.find((a: any) => a.AccountType === 'Cost of Goods Sold');
      expenseAccountId = cogsAccount?.Id || expenseAccounts[0]?.Id || null;
      
      if (expenseAccountId) {
        console.log(`Found expense account: ${cogsAccount?.Name || expenseAccounts[0]?.Name} (ID: ${expenseAccountId})`);
      }
    } catch (expenseError) {
      console.warn('Could not fetch expense accounts:', expenseError);
    }
    
    console.log(`Account lookup complete - Service: ${serviceIncomeAccountId}, Product: ${productIncomeAccountId}, Expense: ${expenseAccountId}`);
    
    return {
      serviceIncomeAccountId,
      productIncomeAccountId,
      expenseAccountId
    };
  } catch (error) {
    console.error('Error fetching income accounts:', error);
    return {
      serviceIncomeAccountId: null,
      productIncomeAccountId: null,
      expenseAccountId: null
    };
  }
}

// Helper to build QB item with correct account refs based on item type
function buildQBItem(product: any, accounts: AccountCache): any {
  const isService = product.item_type === 'service';
  const isLabor = product.item_type === 'labor';
  
  // Determine the correct income account based on item type
  let incomeAccountId: string;
  if (isService || isLabor) {
    // Services and labor use service income account
    incomeAccountId = accounts.serviceIncomeAccountId || accounts.productIncomeAccountId || '1';
  } else {
    // Products use product income account
    incomeAccountId = accounts.productIncomeAccountId || accounts.serviceIncomeAccountId || '1';
  }
  
  const expenseAccountId = accounts.expenseAccountId || '1';
  
  console.log(`Building QB item for "${product.name}" (type: ${product.item_type}) - Income Account: ${incomeAccountId}, Expense Account: ${expenseAccountId}`);
  
  return {
    Name: product.name.substring(0, 100), // QB limit
    Description: product.description?.substring(0, 4000) || '',
    Type: isService || isLabor ? 'Service' : 'NonInventory',
    UnitPrice: product.price,
    PurchaseCost: product.cost,
    Sku: product.sku || undefined,
    Taxable: product.is_taxable,
    IncomeAccountRef: { value: incomeAccountId },
    ExpenseAccountRef: { value: expenseAccountId },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if (authResult.error) {
      return authResult.error;
    }

    // Parse body once to avoid "Body already consumed" error
    const body = await req.json();
    const { action, productId, products, resolution, newPrice } = body;
    console.log(`QuickBooks product sync - Action: ${action}, by user: ${authResult.userId}`);
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { accessToken, realmId } = await getValidToken(supabase);

    if (action === 'import') {
      // Import all products from QuickBooks
      console.log('Importing products from QuickBooks...');
      
      const query = "SELECT * FROM Item WHERE Type IN ('Inventory', 'NonInventory', 'Service') MAXRESULTS 1000";
      const result = await qbRequest('GET', `/query?query=${encodeURIComponent(query)}&minorversion=65`, accessToken, realmId);
      
      const qbItems = result.QueryResponse?.Item || [];
      console.log(`Found ${qbItems.length} items in QuickBooks`);

      let imported = 0;
      let updated = 0;
      let conflicts = 0;

      for (const item of qbItems) {
        // Check if mapping exists
        const { data: existingMapping } = await supabase
          .from('quickbooks_product_mappings')
          .select('*, products(*)')
          .eq('quickbooks_item_id', item.Id)
          .single();

        const productData = {
          name: item.Name,
          description: item.Description || item.PurchaseDesc || null,
          price: parseFloat(item.UnitPrice || '0'),
          cost: parseFloat(item.PurchaseCost || '0'),
          markup: item.UnitPrice && item.PurchaseCost && parseFloat(item.PurchaseCost) > 0
            ? ((parseFloat(item.UnitPrice) - parseFloat(item.PurchaseCost)) / parseFloat(item.PurchaseCost)) * 100
            : 0,
          sku: item.Sku || null,
          unit: 'each',
          category: 'General',
          item_type: item.Type === 'Service' ? 'service' : 'product',
          is_taxable: item.Taxable || false,
        };

        if (existingMapping) {
          // Check for price conflict
          const existingProduct = existingMapping.products;
          if (existingProduct && Math.abs(existingProduct.price - productData.price) > 0.01) {
            // Mark as conflict
            await supabase
              .from('quickbooks_product_mappings')
              .update({
                sync_status: 'conflict',
                conflict_data: {
                  commandx_price: existingProduct.price,
                  quickbooks_price: productData.price,
                  quickbooks_name: item.Name,
                },
              })
              .eq('id', existingMapping.id);
            conflicts++;
          } else {
            // Update product
            await supabase
              .from('products')
              .update(productData)
              .eq('id', existingMapping.product_id);
            
            await supabase
              .from('quickbooks_product_mappings')
              .update({
                sync_status: 'synced',
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', existingMapping.id);
            updated++;
          }
        } else {
          // Create new product
          const { data: newProduct, error: productError } = await supabase
            .from('products')
            .insert(productData)
            .select()
            .single();

          if (productError) {
            console.error('Error creating product:', productError);
            continue;
          }

          // Create mapping
          await supabase
            .from('quickbooks_product_mappings')
            .insert({
              product_id: newProduct.id,
              quickbooks_item_id: item.Id,
              sync_status: 'synced',
              sync_direction: 'from_qb',
              last_synced_at: new Date().toISOString(),
            });
          imported++;
        }
      }

      // Log the import
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'product',
        action: 'import',
        status: 'success',
        details: { imported, updated, conflicts, total: qbItems.length },
      });

      // Update last sync time
      await supabase
        .from('quickbooks_config')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('is_connected', true);

      return new Response(JSON.stringify({ 
        success: true, 
        imported, 
        updated, 
        conflicts,
        total: qbItems.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'export') {
      // Export products to QuickBooks
      console.log('Exporting products to QuickBooks...');
      
      // Get income accounts once at the start
      const accounts = await getIncomeAccounts(accessToken, realmId);
      
      // Get products without QB mapping or with pending status
      const { data: productsToExport, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          quickbooks_product_mappings(*)
        `);

      if (productsError) throw productsError;

      let exported = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const product of productsToExport) {
        const mapping = product.quickbooks_product_mappings?.[0];
        
        // Build QB item with correct income account based on item type
        const qbItem = buildQBItem(product, accounts);

        try {
          if (mapping && mapping.quickbooks_item_id) {
            // Update existing QB item - need to get SyncToken first
            const existingItem = await qbRequest('GET', `/item/${mapping.quickbooks_item_id}?minorversion=65`, accessToken, realmId);
            
            const updateData = {
              ...qbItem,
              Id: mapping.quickbooks_item_id,
              SyncToken: existingItem.Item.SyncToken,
              sparse: true,
            };

            await qbRequest('POST', '/item?minorversion=65', accessToken, realmId, updateData);
            
            await supabase
              .from('quickbooks_product_mappings')
              .update({
                sync_status: 'synced',
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', mapping.id);
            updated++;
          } else {
            // Create new QB item
            try {
              const result = await qbRequest('POST', '/item?minorversion=65', accessToken, realmId, qbItem);
              
              await supabase
                .from('quickbooks_product_mappings')
                .insert({
                  product_id: product.id,
                  quickbooks_item_id: result.Item.Id,
                  sync_status: 'synced',
                  sync_direction: 'to_qb',
                  last_synced_at: new Date().toISOString(),
                });
              exported++;
            } catch (createError: unknown) {
              const errorMessage = createError instanceof Error ? createError.message : '';
              
              // Check if it's a "Duplicate Name Exists" error (error code 6240)
              if (errorMessage.includes('6240') || errorMessage.toLowerCase().includes('name supplied already exists')) {
                console.log(`Product "${product.name}" already exists in QuickBooks, finding existing item...`);
                
                // Find the existing item by name
                const existingItem = await findQBItemByName(product.name, accessToken, realmId);
                
                if (existingItem) {
                  console.log(`Found existing QB item: ${existingItem.Id} for product "${product.name}"`);
                  
                  // Create mapping with existing QB item
                  await supabase
                    .from('quickbooks_product_mappings')
                    .insert({
                      product_id: product.id,
                      quickbooks_item_id: existingItem.Id,
                      sync_status: 'synced',
                      sync_direction: 'to_qb',
                      last_synced_at: new Date().toISOString(),
                    });
                  
                  // Update the existing QB item with current data
                  try {
                    await qbRequest('POST', '/item?minorversion=65', accessToken, realmId, {
                      ...qbItem,
                      Id: existingItem.Id,
                      SyncToken: existingItem.SyncToken,
                      sparse: true,
                    });
                    console.log(`Updated existing QB item ${existingItem.Id} with current data`);
                  } catch (updateErr) {
                    console.warn(`Could not update existing QB item: ${updateErr}`);
                  }
                  
                  updated++;
                  continue;
                }
              }
              
              // If not a duplicate error or couldn't recover, log original error
              console.error(`Error exporting product ${product.name}:`, createError);
              errors.push(`${product.name}: ${errorMessage}`);
            }
          }
        } catch (error: unknown) {
          console.error(`Error exporting product ${product.name}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${product.name}: ${errorMessage}`);
        }
      }

      // Log the export
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'product',
        action: 'export',
        status: errors.length > 0 ? 'partial' : 'success',
        details: { exported, updated, errors },
      });

      // Update last sync time
      await supabase
        .from('quickbooks_config')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('is_connected', true);

      return new Response(JSON.stringify({ 
        success: true, 
        exported, 
        updated,
        errors 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync-single') {
      // Sync a single product
      const { data: product, error: productError } = await supabase
        .from('products')
        .select(`
          *,
          quickbooks_product_mappings(*)
        `)
        .eq('id', productId)
        .single();

      if (productError) throw productError;

      // Get income accounts for this sync
      const accounts = await getIncomeAccounts(accessToken, realmId);

      const mapping = product.quickbooks_product_mappings?.[0];
      
      // Build QB item with correct income account based on item type
      const qbItem = buildQBItem(product, accounts);

      if (mapping && mapping.quickbooks_item_id) {
        // Update existing
        const existingItem = await qbRequest('GET', `/item/${mapping.quickbooks_item_id}?minorversion=65`, accessToken, realmId);
        
        const updateData = {
          ...qbItem,
          Id: mapping.quickbooks_item_id,
          SyncToken: existingItem.Item.SyncToken,
          sparse: true,
        };

        await qbRequest('POST', '/item?minorversion=65', accessToken, realmId, updateData);
        
        await supabase
          .from('quickbooks_product_mappings')
          .update({
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
            conflict_data: null,
          })
          .eq('id', mapping.id);
      } else {
        // Create new
        try {
          const result = await qbRequest('POST', '/item?minorversion=65', accessToken, realmId, qbItem);
          
          await supabase
            .from('quickbooks_product_mappings')
            .insert({
              product_id: product.id,
              quickbooks_item_id: result.Item.Id,
              sync_status: 'synced',
              sync_direction: 'to_qb',
              last_synced_at: new Date().toISOString(),
            });
        } catch (createError: unknown) {
          const errorMessage = createError instanceof Error ? createError.message : '';
          
          // Check if it's a "Duplicate Name Exists" error
          if (errorMessage.includes('6240') || errorMessage.toLowerCase().includes('name supplied already exists')) {
            console.log(`Product "${product.name}" already exists in QuickBooks, finding existing item...`);
            
            // Find the existing item by name
            const existingItem = await findQBItemByName(product.name, accessToken, realmId);
            
            if (existingItem) {
              console.log(`Found existing QB item: ${existingItem.Id} for product "${product.name}"`);
              
              // Create mapping with existing QB item
              await supabase
                .from('quickbooks_product_mappings')
                .insert({
                  product_id: product.id,
                  quickbooks_item_id: existingItem.Id,
                  sync_status: 'synced',
                  sync_direction: 'to_qb',
                  last_synced_at: new Date().toISOString(),
                });
              
              // Update the existing QB item with current data
              try {
                await qbRequest('POST', '/item?minorversion=65', accessToken, realmId, {
                  ...qbItem,
                  Id: existingItem.Id,
                  SyncToken: existingItem.SyncToken,
                  sparse: true,
                });
                console.log(`Updated existing QB item ${existingItem.Id} with current data`);
              } catch (updateErr) {
                console.warn(`Could not update existing QB item: ${updateErr}`);
              }
            } else {
              // Couldn't find existing item, rethrow
              throw createError;
            }
          } else {
            // Not a duplicate error, rethrow
            throw createError;
          }
        }
      }

      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'product',
        entity_id: productId,
        action: 'sync',
        status: 'success',
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'resolve-conflict') {
      // Resolve a price conflict - resolution and newPrice come from the body parsed above
      
      const { data: mapping, error: mappingError } = await supabase
        .from('quickbooks_product_mappings')
        .select('*, products(*)')
        .eq('product_id', productId)
        .single();

      if (mappingError || !mapping) {
        throw new Error('Product mapping not found');
      }

      let priceToUse = newPrice;
      
      if (resolution === 'use_commandx') {
        priceToUse = mapping.products.price;
      } else if (resolution === 'use_quickbooks') {
        priceToUse = mapping.conflict_data?.quickbooks_price;
      }

      // Update CommandX product
      await supabase
        .from('products')
        .update({ price: priceToUse })
        .eq('id', productId);

      // Update QuickBooks item
      const existingItem = await qbRequest('GET', `/item/${mapping.quickbooks_item_id}?minorversion=65`, accessToken, realmId);
      
      await qbRequest('POST', '/item?minorversion=65', accessToken, realmId, {
        Id: mapping.quickbooks_item_id,
        SyncToken: existingItem.Item.SyncToken,
        UnitPrice: priceToUse,
        sparse: true,
      });

      // Clear conflict
      await supabase
        .from('quickbooks_product_mappings')
        .update({
          sync_status: 'synced',
          conflict_data: null,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', mapping.id);

      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'product',
        entity_id: productId,
        action: 'resolve_conflict',
        status: 'success',
        details: { resolution, price: priceToUse },
      });

      return new Response(JSON.stringify({ success: true, price: priceToUse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create-qb-product-mapping') {
      // Create a new QB Item from Command X and store the mapping
      const { mappingName, mappingItemType } = body;
      console.log(`Creating QB product mapping: "${mappingName}" (${mappingItemType})`);

      if (!mappingName) {
        throw new Error('mappingName is required');
      }

      const itemType = mappingItemType || 'Service';

      // Get income accounts
      const accounts = await getIncomeAccounts(accessToken, realmId);
      const incomeAccountId = itemType === 'NonInventory'
        ? (accounts.productIncomeAccountId || accounts.serviceIncomeAccountId || '1')
        : (accounts.serviceIncomeAccountId || accounts.productIncomeAccountId || '1');

      const qbItem: any = {
        Name: mappingName.substring(0, 100),
        Type: itemType === 'NonInventory' ? 'NonInventory' : 'Service',
        IncomeAccountRef: { value: incomeAccountId },
      };

      if (accounts.expenseAccountId) {
        qbItem.ExpenseAccountRef = { value: accounts.expenseAccountId };
      }

      let qbItemId: string | null = null;

      try {
        const result = await qbRequest('POST', '/item?minorversion=65', accessToken, realmId, qbItem);
        qbItemId = result.Item.Id;
        console.log(`Created QB item: ${qbItemId}`);
      } catch (createError: unknown) {
        const errorMessage = createError instanceof Error ? createError.message : '';
        
        // Handle duplicate name
        if (errorMessage.includes('6240') || errorMessage.toLowerCase().includes('name supplied already exists')) {
          console.log(`Item "${mappingName}" already exists in QB, finding it...`);
          const existingItem = await findQBItemByName(mappingName, accessToken, realmId);
          if (existingItem) {
            qbItemId = existingItem.Id;
            console.log(`Found existing QB item: ${qbItemId}`);
          } else {
            throw createError;
          }
        } else {
          throw createError;
        }
      }

      // Update the local mapping with the QB item ID
      if (qbItemId && body.mappingId) {
        await supabase
          .from('qb_product_service_mappings')
          .update({
            quickbooks_item_id: qbItemId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.mappingId);
      }

      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'qb_product_mapping',
        action: 'create',
        status: 'success',
        details: { name: mappingName, itemType, qbItemId },
      });

      return new Response(JSON.stringify({ success: true, qbItemId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error: unknown) {
    console.error('QuickBooks product sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
