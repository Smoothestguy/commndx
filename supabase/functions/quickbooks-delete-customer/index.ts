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

// QuickBooks API helper with defensive parsing
async function qbRequest(method: string, endpoint: string, accessToken: string, realmId: string, body?: any) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'identity',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'LovableCloud/1.0',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  console.log(`QB API ${method} ${endpoint} - Status: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
  
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

  // For some operations, QB may return empty body on success
  if (!responseText || responseText.trim() === '') {
    return { success: true };
  }

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

    const { customerId } = await req.json();
    console.log("Deactivating QuickBooks customer for local customer:", customerId, "by user:", authResult.userId);

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Check if customer is mapped to QuickBooks
    const { data: mapping, error: mappingError } = await supabase
      .from("quickbooks_customer_mappings")
      .select("quickbooks_customer_id, sync_status")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (mappingError) {
      console.error("Mapping fetch error:", mappingError);
      throw new Error("Failed to check QuickBooks mapping");
    }

    if (!mapping) {
      console.log("Customer not synced to QuickBooks, nothing to deactivate");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Customer not synced to QuickBooks",
          deactivated: false 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if already deleted/deactivated
    if (mapping.sync_status === 'deleted') {
      console.log("Customer already deactivated in QuickBooks");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Customer already deactivated in QuickBooks",
          deactivated: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qbCustomerId = mapping.quickbooks_customer_id;
    console.log("Found QB customer mapping:", qbCustomerId);

    // Get valid token
    const { accessToken, realmId } = await getValidToken(supabase);

    // First, fetch the current customer from QuickBooks to get the SyncToken
    console.log("Fetching QB customer to get SyncToken...");
    let qbCustomerData;
    try {
      qbCustomerData = await qbRequest(
        "GET", 
        `/customer/${qbCustomerId}`, 
        accessToken, 
        realmId
      );
    } catch (fetchError: any) {
      // If customer not found in QB (already deleted there), clean up mapping
      if (fetchError.message?.includes('404') || fetchError.message?.includes('not found')) {
        console.log("Customer not found in QuickBooks, likely already deleted/deactivated");
        
        await supabase
          .from("quickbooks_customer_mappings")
          .update({
            sync_status: 'deleted',
            updated_at: new Date().toISOString(),
          })
          .eq("customer_id", customerId);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Customer not found in QuickBooks (may already be deleted)",
            deactivated: true 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw fetchError;
    }

    const syncToken = qbCustomerData.Customer.SyncToken;
    console.log("Got SyncToken:", syncToken);

    // QuickBooks doesn't allow hard-deleting customers with transactions
    // Instead, we mark them as inactive (Active: false)
    console.log("Deactivating customer in QuickBooks...");
    const updatePayload = {
      Id: qbCustomerId,
      SyncToken: syncToken,
      Active: false,
      sparse: true,
    };

    await qbRequest(
      "POST",
      "/customer",
      accessToken,
      realmId,
      updatePayload
    );

    console.log("Customer deactivated successfully in QuickBooks");

    // Update mapping to reflect deleted status
    await supabase
      .from("quickbooks_customer_mappings")
      .update({
        sync_status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq("customer_id", customerId);

    // Log successful deactivation
    await supabase.from("quickbooks_sync_logs").insert({
      entity_type: "customer",
      entity_id: customerId,
      action: "delete",
      status: "success",
      details: { quickbooks_customer_id: qbCustomerId, action: "deactivated" },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Customer deactivated in QuickBooks",
        quickbooksCustomerId: qbCustomerId,
        deactivated: true 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("QuickBooks customer deactivate error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, deactivated: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
