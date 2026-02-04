import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DeleteRequest {
  attachmentId: string;
  billId: string;
}

// Get a valid QuickBooks access token, refreshing if needed
async function getValidAccessToken(supabase: any): Promise<{ accessToken: string; realmId: string } | null> {
  const { data: connection, error } = await supabase
    .from("quickbooks_config")
    .select("*")
    .single();

  if (error || !connection) {
    console.error("No QuickBooks connection found:", error);
    return null;
  }

  // Check if token is expired (with 5 min buffer)
  const expiresAt = new Date(connection.expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    return { accessToken: connection.access_token, realmId: connection.realm_id };
  }

  // Token expired, refresh it
  console.log("Access token expired, refreshing...");
  const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID");
  const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.error("QuickBooks credentials not configured");
    return null;
  }

  const tokenResponse = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Failed to refresh token:", errorText);
    return null;
  }

  const tokens = await tokenResponse.json();
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await supabase
    .from("quickbooks_connections")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return { accessToken: tokens.access_token, realmId: connection.realm_id };
}

// Get the QuickBooks base URL
function getQBBaseUrl(): string {
  const useSandbox = Deno.env.get("QUICKBOOKS_USE_SANDBOX") === "true";
  return useSandbox
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
}

// Fetch attachable from QuickBooks to get SyncToken
async function fetchAttachableFromQB(
  qbAttachableId: string,
  accessToken: string,
  realmId: string
): Promise<{ syncToken: string } | null> {
  const baseUrl = getQBBaseUrl();
  const url = `${baseUrl}/v3/company/${realmId}/attachable/${qbAttachableId}?minorversion=65`;

  console.log(`Fetching Attachable ${qbAttachableId} from QuickBooks...`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    console.log(`Attachable ${qbAttachableId} not found in QB (already deleted)`);
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to fetch Attachable: ${response.status}`, errorText);
    throw new Error(`Failed to fetch Attachable: ${response.status}`);
  }

  const data = await response.json();
  return { syncToken: data.Attachable.SyncToken };
}

// Delete attachable from QuickBooks
async function deleteAttachableFromQB(
  qbAttachableId: string,
  syncToken: string,
  accessToken: string,
  realmId: string
): Promise<void> {
  const baseUrl = getQBBaseUrl();
  const url = `${baseUrl}/v3/company/${realmId}/attachable?operation=delete&minorversion=65`;

  console.log(`Deleting Attachable ${qbAttachableId} from QuickBooks...`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      Id: qbAttachableId,
      SyncToken: syncToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to delete Attachable: ${response.status}`, errorText);
    throw new Error(`QuickBooks delete failed: ${response.status} - ${errorText}`);
  }

  console.log(`Successfully deleted Attachable ${qbAttachableId} from QuickBooks`);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Check user role (admin/manager only)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = roles?.map((r) => r.role) || [];
    if (!userRoles.includes("admin") && !userRoles.includes("manager")) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { attachmentId, billId }: DeleteRequest = await req.json();
    if (!attachmentId || !billId) {
      return new Response(JSON.stringify({ error: "Missing attachmentId or billId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing attachment deletion: ${attachmentId} for bill ${billId}`);

    // Look up the QB Attachable ID from the sync log
    const { data: syncLog, error: syncLogError } = await supabase
      .from("quickbooks_sync_log")
      .select("details")
      .eq("entity_type", "bill_attachment")
      .eq("entity_id", attachmentId)
      .eq("action", "upload")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (syncLogError) {
      console.error("Error fetching sync log:", syncLogError);
    }

    const qbAttachableId = syncLog?.details?.qb_attachable_id;

    if (!qbAttachableId) {
      console.log(`No QB Attachable ID found for attachment ${attachmentId} - was never synced`);
      return new Response(
        JSON.stringify({ success: true, message: "Attachment was never synced to QuickBooks" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found QB Attachable ID: ${qbAttachableId}`);

    // Get valid access token
    const tokenData = await getValidAccessToken(supabase);
    if (!tokenData) {
      console.error("Failed to get QuickBooks access token");
      // Log the failure but return success for local deletion
      await supabase.from("quickbooks_sync_log").insert({
        entity_type: "bill_attachment",
        entity_id: attachmentId,
        action: "delete",
        status: "error",
        details: {
          error: "Failed to get QuickBooks access token",
          qb_attachable_id: qbAttachableId,
          bill_id: billId,
        },
      });

      return new Response(
        JSON.stringify({ success: false, error: "QuickBooks authentication failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { accessToken, realmId } = tokenData;

    // Fetch the Attachable to get SyncToken
    const attachableData = await fetchAttachableFromQB(qbAttachableId, accessToken, realmId);

    if (!attachableData) {
      // Attachable already deleted in QB
      console.log("Attachable already deleted in QuickBooks");
      await supabase.from("quickbooks_sync_log").insert({
        entity_type: "bill_attachment",
        entity_id: attachmentId,
        action: "delete",
        status: "success",
        details: {
          qb_attachable_id: qbAttachableId,
          bill_id: billId,
          note: "Already deleted in QuickBooks",
        },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Already deleted in QuickBooks" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete from QuickBooks
    await deleteAttachableFromQB(qbAttachableId, attachableData.syncToken, accessToken, realmId);

    // Log success
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "bill_attachment",
      entity_id: attachmentId,
      action: "delete",
      status: "success",
      details: {
        qb_attachable_id: qbAttachableId,
        bill_id: billId,
      },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Attachment deleted from QuickBooks" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("Error in quickbooks-delete-bill-attachment:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
