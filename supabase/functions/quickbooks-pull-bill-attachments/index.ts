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

// Query QuickBooks for attachables linked to a specific bill
async function queryQBAttachables(
  qbBillId: string,
  accessToken: string,
  realmId: string
): Promise<any[]> {
  // Query for attachables where AttachableRef contains this bill
  const query = `SELECT * FROM Attachable WHERE AttachableRef.EntityRef.Type = 'Bill' AND AttachableRef.EntityRef.value = '${qbBillId}'`;
  const url = `${QUICKBOOKS_BASE_URL}/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;
  
  console.log(`Querying QB attachables for bill ${qbBillId}...`);
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`QB attachables query failed: ${errorText}`);
    return [];
  }

  const data = await response.json();
  return data.QueryResponse?.Attachable || [];
}

// Download and store an attachment from QuickBooks
async function importAttachment(
  supabase: any,
  qbAttachable: any,
  localBillId: string
): Promise<{ success: boolean; fileName?: string; error?: string }> {
  try {
    const fileName = qbAttachable.FileName;
    
    // Check if we already have this attachment
    const { data: existing } = await supabase
      .from("vendor_bill_attachments")
      .select("id")
      .eq("bill_id", localBillId)
      .eq("file_name", fileName)
      .maybeSingle();

    if (existing) {
      console.log(`Attachment "${fileName}" already exists, skipping`);
      return { success: true, fileName, error: "Already exists" };
    }

    // Check for download URI
    if (!qbAttachable.TempDownloadUri) {
      console.log(`No download URI for "${fileName}"`);
      return { success: false, fileName, error: "No download URI available" };
    }

    console.log(`Downloading "${fileName}" from QuickBooks...`);
    
    // Download the file
    const fileResponse = await fetch(qbAttachable.TempDownloadUri);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download: ${fileResponse.status}`);
    }

    const fileBlob = await fileResponse.blob();
    const fileBuffer = await fileBlob.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    // Generate storage path
    const fileExt = fileName?.split('.').pop() || 'bin';
    const storagePath = `vendor_bill/${localBillId}/${Date.now()}-qb-${qbAttachable.Id}.${fileExt}`;

    console.log(`Uploading "${fileName}" to storage: ${storagePath}`);

    // Upload to storage using Blob
    const uploadBlob = new Blob([fileBytes], { 
      type: qbAttachable.ContentType || 'application/octet-stream' 
    });
    
    const { error: uploadError } = await supabase.storage
      .from('document-attachments')
      .upload(storagePath, uploadBlob, {
        contentType: qbAttachable.ContentType || 'application/octet-stream',
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Create attachment record
    const { error: insertError } = await supabase
      .from("vendor_bill_attachments")
      .insert({
        bill_id: localBillId,
        file_name: fileName,
        file_path: storagePath,
        file_type: qbAttachable.ContentType || 'application/octet-stream',
        file_size: qbAttachable.Size || fileBytes.length,
        uploaded_by: null, // From QuickBooks
      });

    if (insertError) {
      throw new Error(`Failed to insert attachment record: ${insertError.message}`);
    }

    console.log(`Successfully imported "${fileName}" from QuickBooks`);
    return { success: true, fileName };

  } catch (error: any) {
    console.error(`Failed to import attachment: ${error.message}`);
    return { success: false, fileName: qbAttachable.FileName, error: error.message };
  }
}

serve(async (req) => {
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
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth
    const userSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: authError } = await userSupabase.auth.getUser();
    
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Check user role (admin or manager only)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = roles?.map((r: any) => r.role) || [];
    const hasPermission = userRoles.includes("admin") || userRoles.includes("manager");

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin or Manager role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { billId } = await req.json();

    if (!billId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: billId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Pulling attachments from QuickBooks for bill: ${billId}`);

    // Get QuickBooks bill mapping
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

    if (!mapping || !mapping.quickbooks_bill_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Bill not synced to QuickBooks yet" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qbBillId = mapping.quickbooks_bill_id;
    console.log(`Found QB bill mapping: ${qbBillId}`);

    // Get QuickBooks token
    const { accessToken, realmId } = await getQuickBooksToken(supabase);

    // Query QuickBooks for attachables linked to this bill
    const attachables = await queryQBAttachables(qbBillId, accessToken, realmId);
    
    console.log(`Found ${attachables.length} attachables in QuickBooks`);

    if (attachables.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          imported: 0, 
          message: "No attachments found in QuickBooks" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Import each attachment
    const results: Array<{ fileName: string; success: boolean; error?: string }> = [];
    
    for (const attachable of attachables) {
      const result = await importAttachment(supabase, attachable, billId);
      results.push({
        fileName: result.fileName || "unknown",
        success: result.success,
        error: result.error,
      });
    }

    const imported = results.filter(r => r.success && !r.error?.includes("Already exists")).length;
    const skipped = results.filter(r => r.error?.includes("Already exists")).length;
    const failed = results.filter(r => !r.success).length;

    // Log the pull operation
    try {
      await supabase.from("quickbooks_sync_log").insert({
        entity_type: "bill_attachment",
        entity_id: billId,
        action: "pull",
        status: failed === 0 ? "success" : "partial",
        error_message: failed > 0 ? `${failed} attachment(s) failed to import` : null,
        details: JSON.stringify({
          qb_bill_id: qbBillId,
          total: attachables.length,
          imported,
          skipped,
          failed,
          results,
        }),
      });
    } catch (logError) {
      console.error("Failed to log pull operation:", logError);
    }

    console.log(`Pull complete: ${imported} imported, ${skipped} skipped, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported,
        skipped,
        failed,
        message: `Imported ${imported} attachment(s) from QuickBooks`,
        details: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error(`Error in quickbooks-pull-bill-attachments: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
