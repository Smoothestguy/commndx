import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

// QuickBooks API helper
async function qbRequest(method: string, endpoint: string, accessToken: string, realmId: string, body?: any) {
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
    throw new Error(`QuickBooks API error: ${response.status}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, productId, products } = await req.json();
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
        
        const qbItem = {
          Name: product.name.substring(0, 100), // QB limit
          Description: product.description?.substring(0, 4000) || '',
          Type: product.item_type === 'service' ? 'Service' : 'NonInventory',
          UnitPrice: product.price,
          PurchaseCost: product.cost,
          Sku: product.sku || undefined,
          Taxable: product.is_taxable,
          IncomeAccountRef: { value: '1' }, // Default income account
          ExpenseAccountRef: { value: '1' }, // Default expense account
        };

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

      const mapping = product.quickbooks_product_mappings?.[0];
      
      const qbItem = {
        Name: product.name.substring(0, 100),
        Description: product.description?.substring(0, 4000) || '',
        Type: product.item_type === 'service' ? 'Service' : 'NonInventory',
        UnitPrice: product.price,
        PurchaseCost: product.cost,
        Sku: product.sku || undefined,
        Taxable: product.is_taxable,
        IncomeAccountRef: { value: '1' },
        ExpenseAccountRef: { value: '1' },
      };

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
      // Resolve a price conflict
      const { resolution, newPrice } = await req.json();
      
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
