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

// Map QuickBooks AccountType to CommandX category_type
function mapAccountTypeToCategoryType(accountType: string): 'vendor' | 'personnel' | 'both' {
  switch (accountType) {
    case 'Other Expense':
      return 'both';
    case 'Expense':
    case 'Cost of Goods Sold':
    default:
      return 'vendor';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { accessToken, realmId } = await getValidToken(supabase);

    // List action - return available QB accounts for manual linking
    if (action === 'list') {
      console.log('Fetching QuickBooks expense accounts for manual linking...');
      
      // Query QuickBooks for expense-type accounts
      const query = "SELECT * FROM Account WHERE AccountType IN ('Expense', 'Cost of Goods Sold', 'Other Expense') AND Active = true MAXRESULTS 500";
      const result = await qbRequest('GET', `/query?query=${encodeURIComponent(query)}&minorversion=65`, accessToken, realmId);
      
      const qbAccounts = result.QueryResponse?.Account || [];
      
      // Get existing mappings to mark which accounts are already linked
      const { data: mappings } = await supabase
        .from('quickbooks_account_mappings')
        .select('quickbooks_account_id');
      
      const mappedIds = new Set(mappings?.map(m => m.quickbooks_account_id) || []);
      
      // Return accounts with mapped flag
      const accounts = qbAccounts.map((acc: any) => ({
        id: acc.Id,
        name: acc.Name,
        type: acc.AccountType,
        subType: acc.AccountSubType || null,
        isMapped: mappedIds.has(acc.Id)
      }));
      
      console.log(`Found ${accounts.length} QB accounts, ${mappedIds.size} already mapped`);
      
      return new Response(JSON.stringify({ success: true, accounts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'import') {
      console.log('Importing expense accounts from QuickBooks...');
      
      // Query QuickBooks for expense-type accounts
      const query = "SELECT * FROM Account WHERE AccountType IN ('Expense', 'Cost of Goods Sold', 'Other Expense') AND Active = true MAXRESULTS 500";
      const result = await qbRequest('GET', `/query?query=${encodeURIComponent(query)}&minorversion=65`, accessToken, realmId);
      
      const qbAccounts = result.QueryResponse?.Account || [];
      console.log(`Found ${qbAccounts.length} expense accounts in QuickBooks`);

      let imported = 0;
      let updated = 0;
      let skipped = 0;

      for (const account of qbAccounts) {
        // Check if mapping exists by quickbooks_account_id
        const { data: existingMapping } = await supabase
          .from('quickbooks_account_mappings')
          .select('*, expense_categories(*)')
          .eq('quickbooks_account_id', account.Id)
          .single();

        const categoryType = mapAccountTypeToCategoryType(account.AccountType);
        
        const categoryData = {
          name: account.Name,
          description: account.Description || account.AccountSubType || null,
          category_type: categoryType,
          is_active: account.Active !== false,
        };

        if (existingMapping) {
          // Update existing expense category
          const { error: updateError } = await supabase
            .from('expense_categories')
            .update({
              name: categoryData.name,
              description: categoryData.description,
              is_active: categoryData.is_active,
            })
            .eq('id', existingMapping.expense_category_id);

          if (updateError) {
            console.error(`Error updating category ${account.Name}:`, updateError);
            skipped++;
            continue;
          }

          // Update mapping
          await supabase
            .from('quickbooks_account_mappings')
            .update({
              quickbooks_account_name: account.Name,
              quickbooks_account_type: account.AccountType,
              quickbooks_account_subtype: account.AccountSubType || null,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', existingMapping.id);

          updated++;
        } else {
          // Check if category with same name already exists
          const { data: existingCategory } = await supabase
            .from('expense_categories')
            .select('id')
            .eq('name', account.Name)
            .single();

          let categoryId: string;

          if (existingCategory) {
            // Link to existing category
            categoryId = existingCategory.id;
            console.log(`Linking existing category "${account.Name}" to QB account ${account.Id}`);
          } else {
            // Create new expense category
            const { data: newCategory, error: categoryError } = await supabase
              .from('expense_categories')
              .insert(categoryData)
              .select()
              .single();

            if (categoryError) {
              console.error(`Error creating category ${account.Name}:`, categoryError);
              skipped++;
              continue;
            }

            categoryId = newCategory.id;
          }

          // Create mapping
          const { error: mappingError } = await supabase
            .from('quickbooks_account_mappings')
            .insert({
              expense_category_id: categoryId,
              quickbooks_account_id: account.Id,
              quickbooks_account_name: account.Name,
              quickbooks_account_type: account.AccountType,
              quickbooks_account_subtype: account.AccountSubType || null,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            });

          if (mappingError) {
            console.error(`Error creating mapping for ${account.Name}:`, mappingError);
            skipped++;
            continue;
          }

          imported++;
        }
      }

      // Log the import
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'expense_category',
        action: 'import',
        status: 'success',
        details: { imported, updated, skipped, total: qbAccounts.length },
      });

      // Update last sync time
      await supabase
        .from('quickbooks_config')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('is_connected', true);

      console.log(`Import complete: ${imported} imported, ${updated} updated, ${skipped} skipped`);

      return new Response(JSON.stringify({ 
        success: true, 
        imported, 
        updated, 
        skipped,
        total: qbAccounts.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in quickbooks-sync-accounts:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
