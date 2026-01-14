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
  const responseText = await response.text();
  
  if (!response.ok) {
    console.error(`QuickBooks API error: ${responseText}`);
    // Parse error to check for duplicate name
    try {
      const errorJson = JSON.parse(responseText);
      const errorCode = errorJson?.Fault?.Error?.[0]?.code;
      if (errorCode === "6240") {
        // Duplicate name error - throw specific error
        throw new DuplicateNameError(errorJson?.Fault?.Error?.[0]?.Message || "Duplicate name exists");
      }
    } catch (e) {
      if (e instanceof DuplicateNameError) throw e;
    }
    throw new Error(`QuickBooks API error: ${response.status}`);
  }

  return responseText ? JSON.parse(responseText) : {};
}

// Custom error for duplicate names
class DuplicateNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateNameError";
  }
}

// Find existing QB customer by name
async function findQBCustomerByName(name: string, accessToken: string, realmId: string): Promise<any | null> {
  const escapedName = name.replace(/'/g, "\\'");
  const query = `SELECT * FROM Customer WHERE DisplayName = '${escapedName}'`;
  try {
    const result = await qbRequest('GET', `/query?query=${encodeURIComponent(query)}&minorversion=65`, accessToken, realmId);
    return result.QueryResponse?.Customer?.[0] || null;
  } catch (e) {
    console.log("Error searching for customer:", e);
    return null;
  }
}

// Create QB customer with duplicate name handling
async function createQBCustomerSafe(qbCustomer: any, accessToken: string, realmId: string): Promise<any> {
  try {
    return await qbRequest('POST', '/customer?minorversion=65', accessToken, realmId, qbCustomer);
  } catch (error) {
    if (error instanceof DuplicateNameError) {
      console.log(`Duplicate name found for "${qbCustomer.DisplayName}", searching for existing...`);
      // Try to find the existing customer
      const existing = await findQBCustomerByName(qbCustomer.DisplayName, accessToken, realmId);
      if (existing) {
        console.log(`Found existing QB customer with ID ${existing.Id}`);
        return { Customer: existing };
      }
      // If not found by exact name, append unique suffix and retry
      const uniqueSuffix = Date.now().toString().slice(-4);
      qbCustomer.DisplayName = `${qbCustomer.DisplayName} (${uniqueSuffix})`.substring(0, 500);
      console.log(`Retrying with unique name: ${qbCustomer.DisplayName}`);
      return await qbRequest('POST', '/customer?minorversion=65', accessToken, realmId, qbCustomer);
    }
    throw error;
  }
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

    const { action, customerId } = await req.json();
    console.log(`QuickBooks customer sync - Action: ${action}, by user: ${authResult.userId}`);
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { accessToken, realmId } = await getValidToken(supabase);

    if (action === 'import') {
      // Import customers from QuickBooks
      console.log('Importing customers from QuickBooks...');
      
      const query = "SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000";
      const result = await qbRequest('GET', `/query?query=${encodeURIComponent(query)}&minorversion=65`, accessToken, realmId);
      
      const qbCustomers = result.QueryResponse?.Customer || [];
      console.log(`Found ${qbCustomers.length} customers in QuickBooks`);

      let imported = 0;
      let updated = 0;

      for (const customer of qbCustomers) {
        // Check if mapping exists
        const { data: existingMapping } = await supabase
          .from('quickbooks_customer_mappings')
          .select('*')
          .eq('quickbooks_customer_id', customer.Id)
          .single();

        // Build address from QB address object
        const billAddr = customer.BillAddr || {};
        const address = [billAddr.Line1, billAddr.City, billAddr.CountrySubDivisionCode, billAddr.PostalCode]
          .filter(Boolean)
          .join(', ');

        const customerData = {
          name: customer.DisplayName,
          email: customer.PrimaryEmailAddr?.Address || `${customer.Id}@quickbooks.local`,
          phone: customer.PrimaryPhone?.FreeFormNumber || null,
          company: customer.CompanyName || null,
          address: address || null,
          customer_type: customer.Job ? 'residential' : 'commercial',
          notes: customer.Notes || null,
        };

        if (existingMapping) {
          // Update existing customer
          await supabase
            .from('customers')
            .update(customerData)
            .eq('id', existingMapping.customer_id);
          
          await supabase
            .from('quickbooks_customer_mappings')
            .update({
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', existingMapping.id);
          updated++;
        } else {
          // Create new customer
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert(customerData)
            .select()
            .single();

          if (customerError) {
            console.error('Error creating customer:', customerError);
            continue;
          }

          // Create mapping
          await supabase
            .from('quickbooks_customer_mappings')
            .insert({
              customer_id: newCustomer.id,
              quickbooks_customer_id: customer.Id,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            });
          imported++;
        }
      }

      // Log the import
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'customer',
        action: 'import',
        status: 'success',
        details: { imported, updated, total: qbCustomers.length },
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
        total: qbCustomers.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'export') {
      // Export customers to QuickBooks
      console.log('Exporting customers to QuickBooks...');
      
      const { data: customersToExport, error: customersError } = await supabase
        .from('customers')
        .select(`
          *,
          quickbooks_customer_mappings(*)
        `);

      if (customersError) throw customersError;

      let exported = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const customer of customersToExport) {
        const mapping = customer.quickbooks_customer_mappings?.[0];
        
        // Parse address into components
        const addressParts = (customer.address || '').split(', ');
        
        const qbCustomer: any = {
          DisplayName: customer.name.substring(0, 500),
          CompanyName: customer.company || undefined,
          PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
          PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
          Notes: customer.notes || undefined,
        };

        if (addressParts.length > 0) {
          qbCustomer.BillAddr = {
            Line1: addressParts[0] || '',
            City: addressParts[1] || '',
            CountrySubDivisionCode: addressParts[2] || '',
            PostalCode: addressParts[3] || '',
          };
        }

        try {
          if (mapping && mapping.quickbooks_customer_id) {
            // Update existing QB customer
            const existingCustomer = await qbRequest('GET', `/customer/${mapping.quickbooks_customer_id}?minorversion=65`, accessToken, realmId);
            
            const updateData = {
              ...qbCustomer,
              Id: mapping.quickbooks_customer_id,
              SyncToken: existingCustomer.Customer.SyncToken,
              sparse: true,
            };

            await qbRequest('POST', '/customer?minorversion=65', accessToken, realmId, updateData);
            
            await supabase
              .from('quickbooks_customer_mappings')
              .update({
                sync_status: 'synced',
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', mapping.id);
            updated++;
          } else {
            // Create new QB customer with duplicate handling
            const result = await createQBCustomerSafe(qbCustomer, accessToken, realmId);
            
            await supabase
              .from('quickbooks_customer_mappings')
              .insert({
                customer_id: customer.id,
                quickbooks_customer_id: result.Customer.Id,
                sync_status: 'synced',
                last_synced_at: new Date().toISOString(),
              });
            exported++;
          }
        } catch (error: unknown) {
          console.error(`Error exporting customer ${customer.name}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${customer.name}: ${errorMessage}`);
        }
      }

      // Log the export
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'customer',
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
      // Sync a single customer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select(`
          *,
          quickbooks_customer_mappings(*)
        `)
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;

      // Get mapping from embedded query
      let mapping = customer.quickbooks_customer_mappings?.[0];
      
      // FALLBACK: If no mapping found via embed, query directly
      if (!mapping) {
        console.log(`[sync-single] No embedded mapping found for customer ${customerId}, checking directly...`);
        const { data: directMapping } = await supabase
          .from('quickbooks_customer_mappings')
          .select('*')
          .eq('customer_id', customerId)
          .single();
        
        if (directMapping) {
          console.log(`[sync-single] Found mapping via direct query: QB ID ${directMapping.quickbooks_customer_id}`);
          mapping = directMapping;
        }
      }
      
      console.log(`[sync-single] Customer: ${customer.name}, Mapping exists: ${!!mapping}, QB ID: ${mapping?.quickbooks_customer_id || 'none'}`);
      
      const addressParts = (customer.address || '').split(', ');
      
      const qbCustomer: any = {
        DisplayName: customer.name.substring(0, 500),
        CompanyName: customer.company || undefined,
        PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
        PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
        Notes: customer.notes || undefined,
      };

      if (addressParts.length > 0) {
        qbCustomer.BillAddr = {
          Line1: addressParts[0] || '',
          City: addressParts[1] || '',
          CountrySubDivisionCode: addressParts[2] || '',
          PostalCode: addressParts[3] || '',
        };
      }

      if (mapping && mapping.quickbooks_customer_id) {
        // Update existing
        const existingCustomer = await qbRequest('GET', `/customer/${mapping.quickbooks_customer_id}?minorversion=65`, accessToken, realmId);
        
        const updateData = {
          ...qbCustomer,
          Id: mapping.quickbooks_customer_id,
          SyncToken: existingCustomer.Customer.SyncToken,
          sparse: true,
        };

        await qbRequest('POST', '/customer?minorversion=65', accessToken, realmId, updateData);
        
        await supabase
          .from('quickbooks_customer_mappings')
          .update({
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', mapping.id);
      } else {
        // Create new with duplicate handling
        const result = await createQBCustomerSafe(qbCustomer, accessToken, realmId);
        
        await supabase
          .from('quickbooks_customer_mappings')
          .insert({
            customer_id: customer.id,
            quickbooks_customer_id: result.Customer.Id,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
          });
      }

      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'customer',
        entity_id: customerId,
        action: 'sync',
        status: 'success',
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Helper action to find or create QB customer for invoices
    if (action === 'find-or-create') {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select(`
          *,
          quickbooks_customer_mappings(*)
        `)
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;

      // Get mapping from embedded query
      let mapping = customer.quickbooks_customer_mappings?.[0];
      
      // FALLBACK: If no mapping found via embed, query directly
      if (!mapping) {
        console.log(`[find-or-create] No embedded mapping found for customer ${customerId}, checking directly...`);
        const { data: directMapping } = await supabase
          .from('quickbooks_customer_mappings')
          .select('*')
          .eq('customer_id', customerId)
          .single();
        
        if (directMapping) {
          console.log(`[find-or-create] Found mapping via direct query: QB ID ${directMapping.quickbooks_customer_id}`);
          mapping = directMapping;
        }
      }

      if (mapping && mapping.quickbooks_customer_id) {
        return new Response(JSON.stringify({ 
          quickbooksCustomerId: mapping.quickbooks_customer_id 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create in QuickBooks with duplicate handling
      const addressParts = (customer.address || '').split(', ');
      
      const qbCustomer: any = {
        DisplayName: customer.name.substring(0, 500),
        CompanyName: customer.company || undefined,
        PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
        PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
      };

      if (addressParts.length > 0) {
        qbCustomer.BillAddr = {
          Line1: addressParts[0] || '',
          City: addressParts[1] || '',
          CountrySubDivisionCode: addressParts[2] || '',
          PostalCode: addressParts[3] || '',
        };
      }

      const result = await createQBCustomerSafe(qbCustomer, accessToken, realmId);
      
      await supabase
        .from('quickbooks_customer_mappings')
        .insert({
          customer_id: customer.id,
          quickbooks_customer_id: result.Customer.Id,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        });

      return new Response(JSON.stringify({ 
        quickbooksCustomerId: result.Customer.Id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error: unknown) {
    console.error('QuickBooks customer sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
