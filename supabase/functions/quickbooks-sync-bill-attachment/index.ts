import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QUICKBOOKS_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";

// Get QuickBooks access token (with refresh if needed)
async function getQuickBooksToken(supabase: any): Promise<{ accessToken: string; realmId: string }> {
  const { data: config, error } = await supabase
    .from("quickbooks_config")
    .select("*")
    .single();

  if (error || !config) {
    throw new Error("QuickBooks not configured");
  }

  // Check if token needs refresh (expires in less than 5 minutes)
  const expiresAt = new Date(config.token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt < fiveMinutesFromNow) {
    console.log("Token expired or expiring soon, refreshing...");
    
    const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID");
    const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");
    
    if (!clientId || !clientSecret) {
      throw new Error("QuickBooks client credentials not configured");
    }

    const refreshResponse = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.refresh_token,
      }),
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      throw new Error(`Token refresh failed: ${errorText}`);
    }

    const tokens = await refreshResponse.json();
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await supabase
      .from("quickbooks_config")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    return { accessToken: tokens.access_token, realmId: config.realm_id };
  }

  return { accessToken: config.access_token, realmId: config.realm_id };
}

// Upload attachment to QuickBooks
async function uploadAttachmentToQB(
  supabase: any,
  attachment: { file_name: string; file_path: string; file_type: string },
  qbBillId: string,
  accessToken: string,
  realmId: string
): Promise<{ success: boolean; attachableId?: string; error?: string }> {
  try {
    console.log(`Downloading attachment from storage: ${attachment.file_path}`);
    
    // Download file from Supabase storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('document-attachments')
      .download(attachment.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${attachment.file_name} - ${downloadError?.message || 'No data'}`);
    }

    // Create multipart form data
    const boundary = `----FormBoundary${Date.now()}`;
    
    const metadata = JSON.stringify({
      AttachableRef: [{
        EntityRef: {
          type: "Bill",
          value: qbBillId
        }
      }],
      FileName: attachment.file_name,
      ContentType: attachment.file_type
    });

    // Convert blob to array buffer for multipart
    const fileBuffer = await fileData.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    // Build multipart body
    const encoder = new TextEncoder();
    const parts = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file_metadata_01"\r\n`,
      `Content-Type: application/json\r\n\r\n`,
      metadata,
      `\r\n--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file_content_01"; filename="${attachment.file_name}"\r\n`,
      `Content-Type: ${attachment.file_type}\r\n\r\n`,
    ];
    
    const preamble = encoder.encode(parts.join(''));
    const postamble = encoder.encode(`\r\n--${boundary}--\r\n`);
    
    // Combine all parts
    const body = new Uint8Array(preamble.length + fileBytes.length + postamble.length);
    body.set(preamble, 0);
    body.set(fileBytes, preamble.length);
    body.set(postamble, preamble.length + fileBytes.length);

    // Upload to QuickBooks
    const uploadUrl = `${QUICKBOOKS_BASE_URL}/${realmId}/upload?minorversion=65`;
    
    console.log(`Uploading attachment "${attachment.file_name}" to QuickBooks...`);
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Accept': 'application/json',
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QuickBooks upload failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const attachableId = result.AttachableResponse?.[0]?.Attachable?.Id;
    
    console.log(`Successfully uploaded attachment "${attachment.file_name}" to QuickBooks: ${attachableId}`);
    return { success: true, attachableId };

  } catch (error: any) {
    console.error(`Attachment upload error for "${attachment.file_name}": ${error.message}`);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  // Log entry immediately for debugging
  console.log(`[ENTRY] quickbooks-sync-bill-attachment called at ${new Date().toISOString()}`);
  console.log(`[ENTRY] Method: ${req.method}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[AUTH] No Authorization header or invalid format");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth for validation
    const userSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

     // Use the JWT from the Authorization header to validate.
     // In edge/runtime contexts there is no persisted session, so getUser() without a token
     // can fail with: "Auth session missing!".
     const token = authHeader.replace("Bearer ", "").trim();
     const { data: userData, error: authError } = await userSupabase.auth.getUser(token);
    
    if (authError || !userData?.user) {
       console.log("[AUTH] getUser failed:", authError?.message || "No user data");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    console.log("[AUTH] Authenticated user:", userId);

    // Check user role (admin or manager only)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = roles?.map((r: any) => r.role) || [];
    const hasPermission = userRoles.includes("admin") || userRoles.includes("manager");

    if (!hasPermission) {
      console.log("[AUTH] User lacks permission, roles:", userRoles);
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin or Manager role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body - qbBillId is now optional (resolved server-side)
    const { attachmentId, billId, qbBillId: providedQbBillId } = await req.json();

    if (!attachmentId || !billId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: attachmentId, billId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Received request: attachmentId=${attachmentId}, billId=${billId}, qbBillId=${providedQbBillId || '(will resolve)'}`);

    // Resolve qbBillId server-side if not provided
    let qbBillId = providedQbBillId;
    if (!qbBillId) {
      const { data: mapping, error: mappingError } = await supabase
        .from("quickbooks_bill_mappings")
        .select("quickbooks_bill_id, sync_status")
        .eq("bill_id", billId)
        .maybeSingle();

      if (mappingError) {
        console.error(`Error fetching QB mapping for bill ${billId}:`, mappingError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to check QuickBooks mapping" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!mapping) {
        console.log(`Bill ${billId} not mapped to QuickBooks yet`);
        return new Response(
          JSON.stringify({ success: false, error: "Bill not synced to QuickBooks yet" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validSyncStatuses = ["synced", "success"];
      if (!validSyncStatuses.includes(mapping.sync_status) || !mapping.quickbooks_bill_id) {
        console.log(`Bill ${billId} has mapping but sync_status=${mapping.sync_status}, qb_id=${mapping.quickbooks_bill_id}`);
        return new Response(
          JSON.stringify({ success: false, error: "Bill not fully synced to QuickBooks yet" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      qbBillId = mapping.quickbooks_bill_id;
      console.log(`Resolved qbBillId=${qbBillId} from mapping for bill ${billId}`);
    }

    console.log(`Syncing attachment ${attachmentId} to QuickBooks bill ${qbBillId}`);

    // Fetch attachment record
    const { data: attachment, error: attachmentError } = await supabase
      .from("vendor_bill_attachments")
      .select("*")
      .eq("id", attachmentId)
      .single();

    if (attachmentError || !attachment) {
      return new Response(
        JSON.stringify({ error: `Attachment not found: ${attachmentId}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify attachment belongs to the specified bill
    if (attachment.bill_id !== billId) {
      return new Response(
        JSON.stringify({ error: "Attachment does not belong to the specified bill" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get QuickBooks token
    const { accessToken, realmId } = await getQuickBooksToken(supabase);

    // Upload attachment to QuickBooks
    const result = await uploadAttachmentToQB(
      supabase,
      {
        file_name: attachment.file_name,
        file_path: attachment.file_path,
        file_type: attachment.file_type,
      },
      qbBillId,
      accessToken,
      realmId
    );

    // Log the sync result
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "bill_attachment",
      entity_id: attachmentId,
      action: "upload",
      status: result.success ? "success" : "error",
      error_message: result.error || null,
      details: {
        bill_id: billId,
        qb_bill_id: qbBillId,
        file_name: attachment.file_name,
        qb_attachable_id: result.attachableId,
      },
    });

    if (result.success) {
      console.log(`Successfully synced attachment ${attachmentId} to QuickBooks`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          attachableId: result.attachableId,
          message: `Attachment "${attachment.file_name}" synced to QuickBooks`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.error(`Failed to sync attachment ${attachmentId}: ${result.error}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error,
          message: `Failed to sync attachment to QuickBooks: ${result.error}`
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error(`Error in quickbooks-sync-bill-attachment: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
