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
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const QB_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';
const BATCH_SIZE = 100;

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

async function getValidToken(supabase: any) {
  const { data: config, error } = await supabase
    .from('quickbooks_config')
    .select('*')
    .single();

  if (error || !config) {
    throw new Error('QuickBooks not connected');
  }

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
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if (authResult.error) {
      return authResult.error;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, vendorId, startPosition = 0 } = await req.json();

    console.log('=== QuickBooks Vendor Sync ===');
    console.log('Action:', action, 'StartPosition:', startPosition, 'by user:', authResult.userId);

    const { accessToken, realmId } = await getValidToken(supabase);

    if (action === 'import') {
      // First, get total count
      const countQuery = "SELECT COUNT(*) FROM Vendor WHERE Active = true";
      const countResult = await qbRequest('GET', `/query?query=${encodeURIComponent(countQuery)}`, accessToken, realmId);
      const totalCount = countResult.QueryResponse?.totalCount || 0;
      
      console.log(`Total vendors in QuickBooks: ${totalCount}`);

      // Import vendors with pagination - QB uses 1-based STARTPOSITION
      const query = `SELECT * FROM Vendor WHERE Active = true STARTPOSITION ${startPosition + 1} MAXRESULTS ${BATCH_SIZE}`;
      const result = await qbRequest('GET', `/query?query=${encodeURIComponent(query)}`, accessToken, realmId);
      
      const qbVendors = result.QueryResponse?.Vendor || [];
      console.log(`Fetched ${qbVendors.length} vendors (batch starting at ${startPosition})`);

      if (qbVendors.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          imported: 0, 
          updated: 0, 
          skipped: 0,
          hasMore: false,
          totalCount,
          processed: startPosition
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Batch fetch existing mappings for this batch
      const qbIds = qbVendors.map((v: any) => v.Id);
      const { data: existingMappings } = await supabase
        .from('quickbooks_vendor_mappings')
        .select('quickbooks_vendor_id, vendor_id')
        .in('quickbooks_vendor_id', qbIds);

      const mappingMap = new Map((existingMappings || []).map((m: any) => [m.quickbooks_vendor_id, m.vendor_id]));

      // Batch fetch existing vendors by email
      const emails = qbVendors
        .filter((v: any) => v.PrimaryEmailAddr?.Address)
        .map((v: any) => v.PrimaryEmailAddr.Address.toLowerCase());
      
      const { data: existingVendors } = await supabase
        .from('vendors')
        .select('id, email')
        .in('email', emails);

      const vendorByEmail = new Map((existingVendors || []).map((v: any) => [v.email?.toLowerCase(), v.id]));

      let imported = 0;
      let updated = 0;
      let skipped = 0;

      // Process vendors
      for (const qbVendor of qbVendors) {
        const qbVendorId = qbVendor.Id;
        
        const vendorData = {
          name: qbVendor.DisplayName || qbVendor.CompanyName || 'Unknown Vendor',
          email: qbVendor.PrimaryEmailAddr?.Address || `vendor-${qbVendorId}@placeholder.com`,
          phone: qbVendor.PrimaryPhone?.FreeFormNumber || null,
          company: qbVendor.CompanyName || null,
          specialty: qbVendor.Notes || null,
          license_number: qbVendor.AcctNum || null,
          status: 'active' as const,
          // Address fields from QuickBooks BillAddr
          address: qbVendor.BillAddr?.Line1 || null,
          city: qbVendor.BillAddr?.City || null,
          state: qbVendor.BillAddr?.CountrySubDivisionCode || null,
          zip: qbVendor.BillAddr?.PostalCode || null,
          // Tax and 1099 fields
          tax_id: qbVendor.TaxIdentifier || null,
          track_1099: qbVendor.Vendor1099 || false,
          // Billing rate
          billing_rate: qbVendor.BillRate || null,
          // Account number
          account_number: qbVendor.AcctNum || null,
        };

        const existingVendorId = mappingMap.get(qbVendorId);

        if (existingVendorId) {
          // Update existing mapped vendor
          await supabase
            .from('vendors')
            .update(vendorData)
            .eq('id', existingVendorId);

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
          const emailMatch = vendorByEmail.get(vendorData.email.toLowerCase());

          if (emailMatch) {
            // Create mapping for existing vendor
            await supabase.from('quickbooks_vendor_mappings').upsert({
              vendor_id: emailMatch,
              quickbooks_vendor_id: qbVendorId,
              sync_status: 'synced',
              sync_direction: 'import',
              last_synced_at: new Date().toISOString(),
            }, { onConflict: 'quickbooks_vendor_id' });
            skipped++;
          } else {
            // Create new vendor
            const { data: newVendor, error: insertError } = await supabase
              .from('vendors')
              .insert(vendorData)
              .select('id')
              .single();

            if (insertError) {
              console.error('Error creating vendor:', insertError);
              skipped++;
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

      const nextPosition = startPosition + qbVendors.length;
      const hasMore = nextPosition < totalCount;

      // Log sync only on final batch
      if (!hasMore) {
        await supabase.from('quickbooks_sync_logs').insert({
          sync_type: 'vendor_import',
          status: 'success',
          records_synced: imported + updated,
          details: { imported, updated, skipped, totalCount },
        });
      }

      console.log(`Batch complete: imported=${imported}, updated=${updated}, skipped=${skipped}, hasMore=${hasMore}`);

      return new Response(JSON.stringify({ 
        success: true, 
        imported, 
        updated, 
        skipped,
        hasMore,
        nextStartPosition: nextPosition,
        totalCount,
        processed: nextPosition
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'export') {
      // Get total count first
      const { count: totalCount } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Export Command-X vendors to QuickBooks with pagination
      const { data: vendors, error: vendorsError } = await supabase
        .from('vendors')
        .select('*')
        .eq('status', 'active')
        .range(startPosition, startPosition + BATCH_SIZE - 1);

      if (vendorsError) throw vendorsError;

      // Batch fetch existing mappings
      const vendorIds = (vendors || []).map(v => v.id);
      const { data: existingMappings } = await supabase
        .from('quickbooks_vendor_mappings')
        .select('vendor_id, quickbooks_vendor_id')
        .in('vendor_id', vendorIds);

      const mappingMap = new Map((existingMappings || []).map((m: any) => [m.vendor_id, m.quickbooks_vendor_id]));

      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const vendor of vendors || []) {
        try {
          const qbVendorId = mappingMap.get(vendor.id);

          const qbVendorData: Record<string, any> = {
            DisplayName: vendor.name,
            CompanyName: vendor.company || vendor.name,
            PrimaryEmailAddr: vendor.email ? { Address: vendor.email } : undefined,
            PrimaryPhone: vendor.phone ? { FreeFormNumber: vendor.phone } : undefined,
            Notes: vendor.specialty || undefined,
            AcctNum: vendor.account_number || vendor.license_number || undefined,
            // Tax and 1099 fields
            TaxIdentifier: vendor.tax_id || undefined,
            Vendor1099: vendor.track_1099 || false,
            // Billing rate
            BillRate: vendor.billing_rate || undefined,
          };
          
          // Add address fields if any address data exists
          if (vendor.address || vendor.city || vendor.state || vendor.zip) {
            qbVendorData.BillAddr = {
              Line1: vendor.address || undefined,
              City: vendor.city || undefined,
              CountrySubDivisionCode: vendor.state || undefined,
              PostalCode: vendor.zip || undefined,
            };
          }

          if (qbVendorId) {
            // Get current vendor from QB to get SyncToken
            const query = `SELECT * FROM Vendor WHERE Id = '${qbVendorId}'`;
            const result = await qbRequest('GET', `/query?query=${encodeURIComponent(query)}`, accessToken, realmId);
            const currentVendor = result.QueryResponse?.Vendor?.[0];

            if (currentVendor) {
              const updateData = {
                ...qbVendorData,
                Id: qbVendorId,
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

      const nextPosition = startPosition + (vendors?.length || 0);
      const hasMore = nextPosition < (totalCount || 0);

      // Log sync only on final batch
      if (!hasMore) {
        await supabase.from('quickbooks_sync_logs').insert({
          sync_type: 'vendor_export',
          status: errors > 0 ? 'partial' : 'success',
          records_synced: created + updated,
          details: { created, updated, errors, totalCount },
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        created, 
        updated, 
        errors,
        hasMore,
        nextStartPosition: nextPosition,
        totalCount: totalCount || 0,
        processed: nextPosition
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

      const { data: existingMapping } = await supabase
        .from('quickbooks_vendor_mappings')
        .select('quickbooks_vendor_id')
        .eq('vendor_id', vendorId)
        .single();

      const qbVendorData: Record<string, any> = {
        DisplayName: vendor.name,
        CompanyName: vendor.company || vendor.name,
        PrimaryEmailAddr: vendor.email ? { Address: vendor.email } : undefined,
        PrimaryPhone: vendor.phone ? { FreeFormNumber: vendor.phone } : undefined,
        Notes: vendor.specialty || undefined,
        AcctNum: vendor.account_number || vendor.license_number || undefined,
        // Tax and 1099 fields
        TaxIdentifier: vendor.tax_id || undefined,
        Vendor1099: vendor.track_1099 || false,
        // Billing rate
        BillRate: vendor.billing_rate || undefined,
      };
      
      // Add address fields if any address data exists
      if (vendor.address || vendor.city || vendor.state || vendor.zip) {
        qbVendorData.BillAddr = {
          Line1: vendor.address || undefined,
          City: vendor.city || undefined,
          CountrySubDivisionCode: vendor.state || undefined,
          PostalCode: vendor.zip || undefined,
        };
      }

      let qbVendorId: string;

      if (existingMapping) {
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
        // First, check if a vendor with this name already exists in QuickBooks
        const displayName = vendor.name.replace(/'/g, "\\'");
        const searchQuery = `SELECT * FROM Vendor WHERE DisplayName = '${displayName}'`;
        console.log('Searching for existing QB vendor:', displayName);
        
        try {
          const searchResult = await qbRequest('GET', `/query?query=${encodeURIComponent(searchQuery)}`, accessToken, realmId);
          const existingQbVendor = searchResult.QueryResponse?.Vendor?.[0];
          
          if (existingQbVendor) {
            // Vendor exists in QB - update it instead of creating
            console.log('Found existing QB vendor with ID:', existingQbVendor.Id);
            const updateData = {
              ...qbVendorData,
              Id: existingQbVendor.Id,
              SyncToken: existingQbVendor.SyncToken,
              sparse: true,
            };
            
            const updateResult = await qbRequest('POST', '/vendor', accessToken, realmId, updateData);
            qbVendorId = updateResult.Vendor.Id;
            
            // Create mapping for the existing QB vendor
            await supabase.from('quickbooks_vendor_mappings').insert({
              vendor_id: vendorId,
              quickbooks_vendor_id: qbVendorId,
              sync_status: 'synced',
              sync_direction: 'export',
              last_synced_at: new Date().toISOString(),
            });
          } else {
            // No existing vendor found - create new
            const result = await qbRequest('POST', '/vendor', accessToken, realmId, qbVendorData);
            qbVendorId = result.Vendor.Id;

            await supabase.from('quickbooks_vendor_mappings').insert({
              vendor_id: vendorId,
              quickbooks_vendor_id: qbVendorId,
              sync_status: 'synced',
              sync_direction: 'export',
              last_synced_at: new Date().toISOString(),
            });
          }
        } catch (searchError) {
          console.error('Error searching for vendor:', searchError);
          // Try to create anyway - if it fails with duplicate, we'll get an error
          const result = await qbRequest('POST', '/vendor', accessToken, realmId, qbVendorData);
          qbVendorId = result.Vendor.Id;

          await supabase.from('quickbooks_vendor_mappings').insert({
            vendor_id: vendorId,
            quickbooks_vendor_id: qbVendorId,
            sync_status: 'synced',
            sync_direction: 'export',
            last_synced_at: new Date().toISOString(),
          });
        }
      }

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
