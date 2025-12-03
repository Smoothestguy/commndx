import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QUICKBOOKS_CLIENT_ID = Deno.env.get('QUICKBOOKS_CLIENT_ID');
const QUICKBOOKS_CLIENT_SECRET = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const QB_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';

async function getValidToken(supabase: any) {
  const { data: config, error } = await supabase
    .from('quickbooks_config')
    .select('*')
    .single();

  if (error || !config) {
    throw new Error('QuickBooks not connected');
  }

  // Check if token needs refresh (expires within 5 minutes)
  const tokenExpiry = new Date(config.token_expires_at);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  if (tokenExpiry.getTime() - now.getTime() < fiveMinutes) {
    console.log('Refreshing QuickBooks token...');
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=refresh_token&refresh_token=${config.refresh_token}`,
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to refresh token');
    }

    const tokens = await tokenResponse.json();
    
    await supabase.from('quickbooks_config').update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', config.id);

    return { accessToken: tokens.access_token, realmId: config.realm_id };
  }

  return { accessToken: config.access_token, realmId: config.realm_id };
}

async function qbRequest(method: string, endpoint: string, accessToken: string, realmId: string, body?: any) {
  const url = `${QB_API_BASE}/${realmId}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`QuickBooks API error: ${response.status} - ${errorText}`);
    throw new Error(`QuickBooks API error: ${response.status}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, vendorId, vendorData } = await req.json();

    console.log('=== QuickBooks Vendor Sync ===');
    console.log('Action:', action);

    const { accessToken, realmId } = await getValidToken(supabase);

    if (action === 'import') {
      // Import vendors from QuickBooks to Command-X
      console.log('Importing vendors from QuickBooks...');
      
      const query = "SELECT * FROM Vendor WHERE Active = true MAXRESULTS 1000";
      const result = await qbRequest('GET', `/query?query=${encodeURIComponent(query)}`, accessToken, realmId);
      
      const qbVendors = result.QueryResponse?.Vendor || [];
      console.log(`Found ${qbVendors.length} vendors in QuickBooks`);

      let imported = 0;
      let updated = 0;
      let skipped = 0;

      for (const qbVendor of qbVendors) {
        const qbVendorId = qbVendor.Id;
        
        // Check if mapping exists
        const { data: existingMapping } = await supabase
          .from('quickbooks_vendor_mappings')
          .select('vendor_id')
          .eq('quickbooks_vendor_id', qbVendorId)
          .single();

        const vendorData = {
          name: qbVendor.DisplayName || qbVendor.CompanyName || 'Unknown Vendor',
          email: qbVendor.PrimaryEmailAddr?.Address || `vendor-${qbVendorId}@placeholder.com`,
          phone: qbVendor.PrimaryPhone?.FreeFormNumber || null,
          company: qbVendor.CompanyName || null,
          specialty: qbVendor.Notes || null,
          license_number: qbVendor.AcctNum || null,
          status: 'active' as const,
        };

        if (existingMapping) {
          // Update existing vendor
          await supabase
            .from('vendors')
            .update(vendorData)
            .eq('id', existingMapping.vendor_id);

          await supabase
            .from('quickbooks_vendor_mappings')
            .update({
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            })
            .eq('quickbooks_vendor_id', qbVendorId);

          updated++;
        } else {
          // Check if vendor with same email exists
          const { data: existingVendor } = await supabase
            .from('vendors')
            .select('id')
            .eq('email', vendorData.email)
            .single();

          if (existingVendor) {
            // Create mapping for existing vendor
            await supabase.from('quickbooks_vendor_mappings').insert({
              vendor_id: existingVendor.id,
              quickbooks_vendor_id: qbVendorId,
              sync_status: 'synced',
              sync_direction: 'import',
              last_synced_at: new Date().toISOString(),
            });
            skipped++;
          } else {
            // Create new vendor
            const { data: newVendor, error: insertError } = await supabase
              .from('vendors')
              .insert(vendorData)
              .select()
              .single();

            if (insertError) {
              console.error('Error creating vendor:', insertError);
              continue;
            }

            // Create mapping
            await supabase.from('quickbooks_vendor_mappings').insert({
              vendor_id: newVendor.id,
              quickbooks_vendor_id: qbVendorId,
              sync_status: 'synced',
              sync_direction: 'import',
              last_synced_at: new Date().toISOString(),
            });

            imported++;
          }
        }
      }

      // Log sync
      await supabase.from('quickbooks_sync_logs').insert({
        sync_type: 'vendor_import',
        status: 'success',
        records_synced: imported + updated,
        details: { imported, updated, skipped, total: qbVendors.length },
      });

      return new Response(JSON.stringify({ 
        success: true, 
        imported, 
        updated, 
        skipped,
        total: qbVendors.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'export') {
      // Export Command-X vendors to QuickBooks
      console.log('Exporting vendors to QuickBooks...');

      const { data: vendors, error: vendorsError } = await supabase
        .from('vendors')
        .select('*')
        .eq('status', 'active');

      if (vendorsError) throw vendorsError;

      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const vendor of vendors || []) {
        try {
          // Check if mapping exists
          const { data: existingMapping } = await supabase
            .from('quickbooks_vendor_mappings')
            .select('quickbooks_vendor_id')
            .eq('vendor_id', vendor.id)
            .single();

          const qbVendorData = {
            DisplayName: vendor.name,
            CompanyName: vendor.company || vendor.name,
            PrimaryEmailAddr: vendor.email ? { Address: vendor.email } : undefined,
            PrimaryPhone: vendor.phone ? { FreeFormNumber: vendor.phone } : undefined,
            Notes: vendor.specialty || undefined,
            AcctNum: vendor.license_number || undefined,
          };

          if (existingMapping) {
            // Get current vendor from QB to get SyncToken
            const query = `SELECT * FROM Vendor WHERE Id = '${existingMapping.quickbooks_vendor_id}'`;
            const result = await qbRequest('GET', `/query?query=${encodeURIComponent(query)}`, accessToken, realmId);
            const currentVendor = result.QueryResponse?.Vendor?.[0];

            if (currentVendor) {
              // Update existing vendor in QB
              const updateData = {
                ...qbVendorData,
                Id: existingMapping.quickbooks_vendor_id,
                SyncToken: currentVendor.SyncToken,
                sparse: true,
              };

              await qbRequest('POST', '/vendor', accessToken, realmId, updateData);

              await supabase
                .from('quickbooks_vendor_mappings')
                .update({
                  sync_status: 'synced',
                  last_synced_at: new Date().toISOString(),
                })
                .eq('vendor_id', vendor.id);

              updated++;
            }
          } else {
            // Create new vendor in QB
            const result = await qbRequest('POST', '/vendor', accessToken, realmId, qbVendorData);
            const newQbVendor = result.Vendor;

            // Create mapping
            await supabase.from('quickbooks_vendor_mappings').insert({
              vendor_id: vendor.id,
              quickbooks_vendor_id: newQbVendor.Id,
              sync_status: 'synced',
              sync_direction: 'export',
              last_synced_at: new Date().toISOString(),
            });

            created++;
          }
        } catch (err) {
          console.error(`Error syncing vendor ${vendor.id}:`, err);
          errors++;
        }
      }

      // Log sync
      await supabase.from('quickbooks_sync_logs').insert({
        sync_type: 'vendor_export',
        status: errors > 0 ? 'partial' : 'success',
        records_synced: created + updated,
        details: { created, updated, errors, total: vendors?.length || 0 },
      });

      return new Response(JSON.stringify({ 
        success: true, 
        created, 
        updated, 
        errors,
        total: vendors?.length || 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync-single') {
      // Sync a single vendor
      console.log('Syncing single vendor:', vendorId);

      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();

      if (vendorError || !vendor) {
        throw new Error('Vendor not found');
      }

      // Check if mapping exists
      const { data: existingMapping } = await supabase
        .from('quickbooks_vendor_mappings')
        .select('quickbooks_vendor_id')
        .eq('vendor_id', vendorId)
        .single();

      const qbVendorData = {
        DisplayName: vendor.name,
        CompanyName: vendor.company || vendor.name,
        PrimaryEmailAddr: vendor.email ? { Address: vendor.email } : undefined,
        PrimaryPhone: vendor.phone ? { FreeFormNumber: vendor.phone } : undefined,
        Notes: vendor.specialty || undefined,
        AcctNum: vendor.license_number || undefined,
      };

      let qbVendorId: string;

      if (existingMapping) {
        // Get current vendor from QB
        const query = `SELECT * FROM Vendor WHERE Id = '${existingMapping.quickbooks_vendor_id}'`;
        const result = await qbRequest('GET', `/query?query=${encodeURIComponent(query)}`, accessToken, realmId);
        const currentVendor = result.QueryResponse?.Vendor?.[0];

        if (currentVendor) {
          const updateData = {
            ...qbVendorData,
            Id: existingMapping.quickbooks_vendor_id,
            SyncToken: currentVendor.SyncToken,
            sparse: true,
          };

          const updateResult = await qbRequest('POST', '/vendor', accessToken, realmId, updateData);
          qbVendorId = updateResult.Vendor.Id;
        } else {
          throw new Error('QuickBooks vendor not found');
        }
      } else {
        // Create new vendor in QB
        const result = await qbRequest('POST', '/vendor', accessToken, realmId, qbVendorData);
        qbVendorId = result.Vendor.Id;

        // Create mapping
        await supabase.from('quickbooks_vendor_mappings').insert({
          vendor_id: vendorId,
          quickbooks_vendor_id: qbVendorId,
          sync_status: 'synced',
          sync_direction: 'export',
          last_synced_at: new Date().toISOString(),
        });
      }

      // Update mapping
      await supabase
        .from('quickbooks_vendor_mappings')
        .update({
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        })
        .eq('vendor_id', vendorId);

      return new Response(JSON.stringify({ 
        success: true, 
        quickbooksVendorId: qbVendorId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Vendor sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
