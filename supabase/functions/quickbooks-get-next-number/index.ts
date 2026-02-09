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

  // Any authenticated user can fetch next document numbers
  // This is a read-only operation that doesn't modify QuickBooks data
  console.log(`Authenticated user ${user.id} for next number generation`);
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
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const yearPrefix = `${prefix}${currentYear}`;

  console.log(`Looking for year-aware prefix: ${yearPrefix}`);
  console.log("Sample doc numbers from QB:", docNumbers.slice(0, 10));

  // Strategy 1: Check for year-prefixed numbers (e.g., "INV-26XXXXX")
  const prefixedNumbers = docNumbers
    .filter(num => num && num.startsWith(yearPrefix))
    .map(num => {
      const afterPrefix = num.substring(yearPrefix.length);
      const seqNum = parseInt(afterPrefix, 10);
      return { original: num, value: isNaN(seqNum) ? 0 : seqNum };
    })
    .filter(item => item.value > 0);

  if (prefixedNumbers.length > 0) {
    const maxItem = prefixedNumbers.reduce((max, item) => item.value > max.value ? item : max);
    const nextNum = maxItem.value + 1;
    const highestNumStr = maxItem.original.substring(yearPrefix.length);
    const paddingLength = Math.max(highestNumStr.length, 5);
    const result = `${yearPrefix}${nextNum.toString().padStart(paddingLength, '0')}`;
    console.log(`Found prefixed numbers. Highest: ${maxItem.original}, next: ${result}`);
    return result;
  }

  // Strategy 2: Check for plain numeric numbers (e.g., "3328", "3327")
  const plainNumbers = docNumbers
    .filter(num => num && /^\d+$/.test(num))
    .map(num => parseInt(num, 10))
    .filter(n => !isNaN(n) && n > 0);

  if (plainNumbers.length > 0) {
    const max = Math.max(...plainNumbers);
    const result = String(max + 1);
    console.log(`Found plain numeric numbers. Highest: ${max}, next: ${result}`);
    return result;
  }

  // Strategy 3: No numbers found at all, start new prefixed sequence
  console.log(`No existing numbers found, starting fresh: ${yearPrefix}00001`);
  return `${yearPrefix}00001`;
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
      // Query QuickBooks - increased limit for better coverage
      const query = "SELECT DocNumber FROM Invoice ORDERBY MetaData.CreateTime DESC MAXRESULTS 500";
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
      // Query QuickBooks - increased limit for better coverage
      const query = "SELECT DocNumber FROM Estimate ORDERBY MetaData.CreateTime DESC MAXRESULTS 500";
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
      // Query QuickBooks - increased limit for better coverage
      const query = "SELECT DocNumber FROM PurchaseOrder ORDERBY MetaData.CreateTime DESC MAXRESULTS 500";
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
      // vendor_bill - increased limit for better coverage
      const query = "SELECT DocNumber FROM Bill ORDERBY MetaData.CreateTime DESC MAXRESULTS 500";
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
