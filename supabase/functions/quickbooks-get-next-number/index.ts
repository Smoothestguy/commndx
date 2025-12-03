import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUICKBOOKS_API_BASE = "https://quickbooks.api.intuit.com/v3/company";

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
  // Find the highest number with the given prefix
  const numbers = docNumbers
    .filter(num => num && num.startsWith(prefix))
    .map(num => {
      const match = num.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => !isNaN(n));

  const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
  const nextNum = maxNum + 1;
  
  // Pad to at least 4 digits
  return `${prefix}${nextNum.toString().padStart(4, '0')}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type } = await req.json();

    if (!type || !["invoice", "estimate"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid type. Must be 'invoice' or 'estimate'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Getting next QuickBooks ${type} number`);

    const { accessToken, realmId } = await getValidToken(supabase);

    let nextNumber: string;

    if (type === "invoice") {
      // Query the last 100 invoices to find the highest number
      const query = "SELECT DocNumber FROM Invoice ORDERBY MetaData.CreateTime DESC MAXRESULTS 100";
      const result = await qbQuery(query, accessToken, realmId);
      
      const docNumbers = result.QueryResponse?.Invoice?.map((inv: any) => inv.DocNumber) || [];
      console.log(`Found ${docNumbers.length} invoices in QuickBooks`);
      
      nextNumber = extractNextNumber(docNumbers, "INV-");
    } else {
      // Query the last 100 estimates to find the highest number
      const query = "SELECT DocNumber FROM Estimate ORDERBY MetaData.CreateTime DESC MAXRESULTS 100";
      const result = await qbQuery(query, accessToken, realmId);
      
      const docNumbers = result.QueryResponse?.Estimate?.map((est: any) => est.DocNumber) || [];
      console.log(`Found ${docNumbers.length} estimates in QuickBooks`);
      
      nextNumber = extractNextNumber(docNumbers, "EST-");
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
