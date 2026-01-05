import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const QUICKBOOKS_API_BASE = "https://quickbooks.api.intuit.com/v3/company";

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
    .from("quickbooks_config")
    .select("*")
    .single();

  if (error || !config) {
    throw new Error("QuickBooks not connected");
  }

  // Check if token needs refresh (expires in less than 5 minutes)
  const expiresAt = new Date(config.token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt < fiveMinutesFromNow) {
    // Refresh the token
    const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID");
    const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");

    const tokenResponse = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.refresh_token,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(`Token refresh failed: ${tokenData.error_description || tokenData.error}`);
    }

    // Update tokens in database
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    await supabase
      .from("quickbooks_config")
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    return { accessToken: tokenData.access_token, realmId: config.realm_id };
  }

  return { accessToken: config.access_token, realmId: config.realm_id };
}

async function qbQuery(query: string, accessToken: string, realmId: string) {
  const url = `${QUICKBOOKS_API_BASE}/${realmId}/query?query=${encodeURIComponent(query)}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("QuickBooks query error:", errorText);
    throw new Error(`QuickBooks API error: ${response.status}`);
  }

  return response.json();
}

function extractNextNumber(docNumbers: string[], prefix: string): string {
  // Log sample for debugging
  console.log("Sample doc numbers from QB:", docNumbers.slice(0, 10));
  
  // Extract numbers from ALL document numbers, regardless of prefix
  const allNumbers = docNumbers
    .map(num => {
      if (!num) return { original: num, value: 0 };
      // Extract any trailing number from the string
      const match = num.match(/(\d+)$/);
      return { 
        original: num, 
        value: match ? parseInt(match[1], 10) : 0 
      };
    })
    .filter(item => item.value > 0);

  if (allNumbers.length === 0) {
    // No valid numbers found, start fresh with our format
    return `${prefix}0001`;
  }

  // Find the highest number
  const maxItem = allNumbers.reduce((max, item) => 
    item.value > max.value ? item : max
  );
  
  console.log(`Highest number found: ${maxItem.original} (value: ${maxItem.value})`);
  
  const nextNum = maxItem.value + 1;
  
  // Check if the highest number uses the expected prefix format
  if (maxItem.original.startsWith(prefix)) {
    // Match the existing format with proper padding
    const paddingMatch = maxItem.original.match(new RegExp(`^${prefix}(\\d+)$`));
    if (paddingMatch) {
      const paddingLength = paddingMatch[1].length;
      return `${prefix}${nextNum.toString().padStart(paddingLength, '0')}`;
    }
    return `${prefix}${nextNum.toString().padStart(4, '0')}`;
  }
  
  // QB uses a different format - detect and match it
  const sampleNum = maxItem.original;
  
  // Check if it's a plain number (possibly with leading zeros)
  if (/^\d+$/.test(sampleNum)) {
    return nextNum.toString().padStart(sampleNum.length, '0');
  }
  
  // Check for any prefix pattern (e.g., "Invoice-", "Inv", etc.)
  const prefixMatch = sampleNum.match(/^([A-Za-z-]+)(\d+)$/);
  if (prefixMatch) {
    const detectedPrefix = prefixMatch[1];
    const numberPart = prefixMatch[2];
    console.log(`Detected QB prefix: "${detectedPrefix}", padding: ${numberPart.length}`);
    return `${detectedPrefix}${nextNum.toString().padStart(numberPart.length, '0')}`;
  }
  
  // Fallback: use our standard format
  return `${prefix}${nextNum.toString().padStart(4, '0')}`;
}

serve(async (req) => {
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

    const { type } = await req.json();

    if (!type || !["invoice", "estimate", "purchase_order", "vendor_bill"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid type. Must be 'invoice', 'estimate', 'purchase_order', or 'vendor_bill'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Getting next ${type} number (checking both QuickBooks and local DB) by user: ${authResult.userId}`);

    const { accessToken, realmId } = await getValidToken(supabase);

    let nextNumber: string;
    let qbDocNumbers: string[] = [];
    let localDocNumbers: string[] = [];

    if (type === "invoice") {
      // Query QuickBooks
      const query = "SELECT DocNumber FROM Invoice ORDERBY MetaData.CreateTime DESC MAXRESULTS 100";
      const result = await qbQuery(query, accessToken, realmId);
      qbDocNumbers = result.QueryResponse?.Invoice?.map((inv: any) => inv.DocNumber) || [];
      
      // Query local database
      const { data: localInvoices } = await supabase
        .from("invoices")
        .select("number")
        .order("created_at", { ascending: false })
        .limit(200);
      localDocNumbers = localInvoices?.map((inv: any) => inv.number) || [];
      
      console.log(`Found ${qbDocNumbers.length} invoices in QB, ${localDocNumbers.length} in local DB`);
      
      const allNumbers = [...qbDocNumbers, ...localDocNumbers];
      nextNumber = extractNextNumber(allNumbers, "INV-");
    } else if (type === "estimate") {
      // Query QuickBooks
      const query = "SELECT DocNumber FROM Estimate ORDERBY MetaData.CreateTime DESC MAXRESULTS 100";
      const result = await qbQuery(query, accessToken, realmId);
      qbDocNumbers = result.QueryResponse?.Estimate?.map((est: any) => est.DocNumber) || [];
      
      // Query local database
      const { data: localEstimates } = await supabase
        .from("estimates")
        .select("number")
        .order("created_at", { ascending: false })
        .limit(200);
      localDocNumbers = localEstimates?.map((est: any) => est.number) || [];
      
      console.log(`Found ${qbDocNumbers.length} estimates in QB, ${localDocNumbers.length} in local DB`);
      
      const allNumbers = [...qbDocNumbers, ...localDocNumbers];
      nextNumber = extractNextNumber(allNumbers, "EST-");
    } else if (type === "purchase_order") {
      // Query QuickBooks
      const query = "SELECT DocNumber FROM PurchaseOrder ORDERBY MetaData.CreateTime DESC MAXRESULTS 100";
      const result = await qbQuery(query, accessToken, realmId);
      qbDocNumbers = result.QueryResponse?.PurchaseOrder?.map((po: any) => po.DocNumber) || [];
      
      // Query local database
      const { data: localPOs } = await supabase
        .from("purchase_orders")
        .select("number")
        .order("created_at", { ascending: false })
        .limit(200);
      localDocNumbers = localPOs?.map((po: any) => po.number) || [];
      
      console.log(`Found ${qbDocNumbers.length} POs in QB, ${localDocNumbers.length} in local DB`);
      
      const allNumbers = [...qbDocNumbers, ...localDocNumbers];
      nextNumber = extractNextNumber(allNumbers, "PO-");
    } else {
      // vendor_bill
      const query = "SELECT DocNumber FROM Bill ORDERBY MetaData.CreateTime DESC MAXRESULTS 100";
      const result = await qbQuery(query, accessToken, realmId);
      qbDocNumbers = result.QueryResponse?.Bill?.map((bill: any) => bill.DocNumber) || [];
      
      // Query local database
      const { data: localBills } = await supabase
        .from("vendor_bills")
        .select("number")
        .order("created_at", { ascending: false })
        .limit(200);
      localDocNumbers = localBills?.map((bill: any) => bill.number) || [];
      
      console.log(`Found ${qbDocNumbers.length} bills in QB, ${localDocNumbers.length} in local DB`);
      
      const allNumbers = [...qbDocNumbers, ...localDocNumbers];
      nextNumber = extractNextNumber(allNumbers, "BILL-");
    }

    console.log(`Next ${type} number: ${nextNumber}`);

    return new Response(
      JSON.stringify({ nextNumber }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error getting next number:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
