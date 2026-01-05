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

    const { invoiceId } = await req.json();
    console.log("Voiding QuickBooks invoice for local invoice:", invoiceId, "by user:", authResult.userId);

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Check if invoice is mapped to QuickBooks
    const { data: mapping, error: mappingError } = await supabase
      .from("quickbooks_invoice_mappings")
      .select("quickbooks_invoice_id, sync_status")
      .eq("invoice_id", invoiceId)
      .maybeSingle();

    if (mappingError) {
      console.error("Mapping fetch error:", mappingError);
      throw new Error("Failed to check QuickBooks mapping");
    }

    if (!mapping) {
      console.log("Invoice not synced to QuickBooks, nothing to void");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Invoice not synced to QuickBooks",
          voided: false 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if already voided
    if (mapping.sync_status === 'voided') {
      console.log("Invoice already voided in QuickBooks");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Invoice already voided in QuickBooks",
          voided: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qbInvoiceId = mapping.quickbooks_invoice_id;
    console.log("Found QB invoice mapping:", qbInvoiceId);

    // Get valid token
    const { accessToken, realmId } = await getValidToken(supabase);

    // First, fetch the current invoice from QuickBooks to get the SyncToken
    console.log("Fetching QB invoice to get SyncToken...");
    const qbInvoiceData = await qbRequest(
      "GET", 
      `/invoice/${qbInvoiceId}`, 
      accessToken, 
      realmId
    );

    const syncToken = qbInvoiceData.Invoice.SyncToken;
    console.log("Got SyncToken:", syncToken);

    // Check if invoice has payments (cannot void if payments exist)
    if (qbInvoiceData.Invoice.Balance !== qbInvoiceData.Invoice.TotalAmt) {
      const paidAmount = qbInvoiceData.Invoice.TotalAmt - qbInvoiceData.Invoice.Balance;
      console.warn(`Invoice has payments (${paidAmount} paid), cannot void directly`);
      
      // Update mapping to indicate void failed
      await supabase
        .from("quickbooks_invoice_mappings")
        .update({
          sync_status: 'void_failed',
          updated_at: new Date().toISOString(),
        })
        .eq("invoice_id", invoiceId);

      // Log the failure
      await supabase.from("quickbooks_sync_logs").insert({
        entity_type: "invoice",
        entity_id: invoiceId,
        action: "void",
        status: "error",
        details: { 
          quickbooks_invoice_id: qbInvoiceId,
          error: `Invoice has payments (${paidAmount} paid). Please void payments in QuickBooks first.`
        },
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Cannot void invoice with payments. The invoice has $${paidAmount.toFixed(2)} in payments. Please void the payments in QuickBooks first.`,
          voided: false 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Void the invoice in QuickBooks
    console.log("Voiding invoice in QuickBooks...");
    const voidPayload = {
      Id: qbInvoiceId,
      SyncToken: syncToken,
    };

    const voidResponse = await qbRequest(
      "POST",
      "/invoice?operation=void",
      accessToken,
      realmId,
      voidPayload
    );

    console.log("Invoice voided successfully:", voidResponse.Invoice?.Id);

    // Update mapping to reflect voided status
    await supabase
      .from("quickbooks_invoice_mappings")
      .update({
        sync_status: 'voided',
        updated_at: new Date().toISOString(),
      })
      .eq("invoice_id", invoiceId);

    // Log successful void
    await supabase.from("quickbooks_sync_logs").insert({
      entity_type: "invoice",
      entity_id: invoiceId,
      action: "void",
      status: "success",
      details: { quickbooks_invoice_id: qbInvoiceId },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Invoice voided in QuickBooks",
        quickbooksInvoiceId: qbInvoiceId,
        voided: true 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("QuickBooks invoice void error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, voided: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
