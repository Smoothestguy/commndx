import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, intuit-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const QB_CLIENT_ID = Deno.env.get("QUICKBOOKS_CLIENT_ID")!;
const QB_CLIENT_SECRET = Deno.env.get("QUICKBOOKS_CLIENT_SECRET")!;
const WEBHOOK_VERIFIER_TOKEN = Deno.env.get("QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN")!;

interface WebhookPayload {
  eventNotifications: Array<{
    realmId: string;
    dataChangeEvent: {
      entities: Array<{
        name: string;
        id: string;
        operation: "Create" | "Update" | "Delete" | "Merge" | "Void";
        lastUpdated: string;
      }>;
    };
  }>;
}

// Verify the webhook signature from QuickBooks
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(WEBHOOK_VERIFIER_TOKEN),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payload)
    );
    
    const expectedSignature = encode(signatureBuffer);
    return signature === expectedSignature;
  } catch (error) {
    console.error("[Webhook] Signature verification error:", error);
    return false;
  }
}

// Get valid QuickBooks access token
async function getValidToken(supabase: any) {
  const { data: config, error } = await supabase
    .from("quickbooks_config")
    .select("*")
    .single();

  if (error || !config) {
    throw new Error("QuickBooks not connected");
  }

  const now = new Date();
  const tokenExpiry = new Date(config.token_expires_at);

  if (now >= tokenExpiry) {
    console.log("[Webhook] Token expired, refreshing...");
    const refreshResponse = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.refresh_token,
      }),
    });

    if (!refreshResponse.ok) {
      throw new Error("Failed to refresh token");
    }

    const tokens = await refreshResponse.json();
    const newExpiry = new Date(now.getTime() + tokens.expires_in * 1000);

    await supabase
      .from("quickbooks_config")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    return { accessToken: tokens.access_token, realmId: config.realm_id };
  }

  return { accessToken: config.access_token, realmId: config.realm_id };
}

// Fetch estimate from QuickBooks
async function fetchQBEstimate(estimateId: string, accessToken: string, realmId: string) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/estimate/${estimateId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch QB estimate: ${errorText}`);
  }

  const data = await response.json();
  return data.Estimate;
}

// Fetch bill from QuickBooks
async function fetchQBBill(billId: string, accessToken: string, realmId: string) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/bill/${billId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch QB bill: ${errorText}`);
  }

  const data = await response.json();
  return data.Bill;
}

// Fetch invoice from QuickBooks
async function fetchQBInvoice(invoiceId: string, accessToken: string, realmId: string) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice/${invoiceId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch QB invoice: ${errorText}`);
  }

  const data = await response.json();
  return data.Invoice;
}

// Fetch customer from QuickBooks
async function fetchQBCustomer(customerId: string, accessToken: string, realmId: string) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/customer/${customerId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch QB customer: ${errorText}`);
  }

  const data = await response.json();
  return data.Customer;
}

// Fetch vendor from QuickBooks
async function fetchQBVendor(vendorId: string, accessToken: string, realmId: string) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/vendor/${vendorId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch QB vendor: ${errorText}`);
  }

  const data = await response.json();
  return data.Vendor;
}

// Query QuickBooks for attachables linked to a specific bill
async function queryQBAttachablesForBill(
  qbBillId: string,
  accessToken: string,
  realmId: string
): Promise<any[]> {
  const query = `SELECT * FROM Attachable WHERE AttachableRef.EntityRef.Type = 'Bill' AND AttachableRef.EntityRef.value = '${qbBillId}'`;
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;
  
  console.log(`[Webhook] Querying QB attachables for bill ${qbBillId}...`);
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Webhook] QB attachables query failed: ${errorText}`);
    return [];
  }

  const data = await response.json();
  const attachables = data.QueryResponse?.Attachable || [];
  console.log(`[Webhook] Found ${attachables.length} attachables in QuickBooks for bill ${qbBillId}`);
  return attachables;
}

// Reconcile local attachments with QuickBooks after a Bill Update
async function reconcileBillAttachments(
  supabase: any,
  localBillId: string,
  qbBillId: string,
  accessToken: string,
  realmId: string
) {
  try {
    console.log(`[Webhook] Reconciling attachments for bill ${localBillId} (QB: ${qbBillId})...`);
    
    // 1. Query QuickBooks for current attachables
    const qbAttachables = await queryQBAttachablesForBill(qbBillId, accessToken, realmId);
    
    // Build sets for matching
    const qbAttachableIds = new Set(qbAttachables.map((a: any) => a.Id));
    const qbFileNames = new Set(qbAttachables.map((a: any) => a.FileName?.toLowerCase()));
    
    console.log(`[Webhook] QB has ${qbAttachableIds.size} attachables, filenames: ${Array.from(qbFileNames).join(', ')}`);
    
    // 2. Get local attachments for this bill
    const { data: localAttachments, error: fetchError } = await supabase
      .from("vendor_bill_attachments")
      .select("id, file_name, file_path, uploaded_by")
      .eq("bill_id", localBillId);
    
    if (fetchError) {
      console.error("[Webhook] Error fetching local attachments:", fetchError);
      return;
    }
    
    if (!localAttachments || localAttachments.length === 0) {
      console.log("[Webhook] No local attachments to reconcile");
      return;
    }
    
    console.log(`[Webhook] Found ${localAttachments.length} local attachments to check`);
    
    // 3. Check each local attachment
    const toDelete: Array<{ id: string; file_path: string; reason: string }> = [];
    
    for (const local of localAttachments) {
      let existsInQB = false;
      let matchReason = "";
      
      // Check if it's a QB-sourced attachment (file_path contains -qb-)
      const qbIdMatch = local.file_path?.match(/-qb-(\d+)\./);
      if (qbIdMatch) {
        const embeddedQbId = qbIdMatch[1];
        if (qbAttachableIds.has(embeddedQbId)) {
          existsInQB = true;
          matchReason = `matched by embedded QB ID ${embeddedQbId}`;
        }
      }
      
      // Fallback: check by filename
      if (!existsInQB && local.file_name) {
        if (qbFileNames.has(local.file_name.toLowerCase())) {
          existsInQB = true;
          matchReason = `matched by filename ${local.file_name}`;
        }
      }
      
      // For CommandX-uploaded attachments, check sync log for qb_attachable_id
      if (!existsInQB && local.uploaded_by) {
        const { data: syncLog } = await supabase
          .from("quickbooks_sync_log")
          .select("details")
          .eq("entity_type", "bill_attachment")
          .eq("entity_id", local.id)
          .eq("status", "success")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (syncLog?.details) {
          try {
            const details = typeof syncLog.details === 'string' 
              ? JSON.parse(syncLog.details) 
              : syncLog.details;
            const qbAttachableId = details?.qb_attachable_id;
            
            if (qbAttachableId) {
              if (qbAttachableIds.has(qbAttachableId)) {
                existsInQB = true;
                matchReason = `matched by sync log QB ID ${qbAttachableId}`;
              } else {
                // Has a QB ID but not in current QB set - should be deleted
                console.log(`[Webhook] Attachment ${local.id} has QB ID ${qbAttachableId} but it's not in QuickBooks anymore`);
              }
            } else {
              // No QB ID in sync log = local-only, don't delete
              existsInQB = true;
              matchReason = "local-only (no qb_attachable_id in sync log)";
            }
          } catch (parseErr) {
            console.error("[Webhook] Failed to parse sync log details:", parseErr);
            // Skip on parse error to be safe
            existsInQB = true;
            matchReason = "skipped due to parse error";
          }
        } else {
          // No sync log = not yet synced to QB, don't delete
          existsInQB = true;
          matchReason = "local-only (no sync log)";
        }
      }
      
      if (existsInQB) {
        console.log(`[Webhook] Attachment ${local.id} exists: ${matchReason}`);
      } else {
        console.log(`[Webhook] Attachment ${local.id} (${local.file_name}) NOT found in QuickBooks - marking for deletion`);
        toDelete.push({ 
          id: local.id, 
          file_path: local.file_path, 
          reason: "Missing in QuickBooks" 
        });
      }
    }
    
    // 4. Delete attachments that no longer exist in QuickBooks
    if (toDelete.length > 0) {
      console.log(`[Webhook] Deleting ${toDelete.length} attachment(s) not found in QuickBooks`);
      
      for (const item of toDelete) {
        // Delete from storage
        try {
          await supabase.storage
            .from("document-attachments")
            .remove([item.file_path]);
          console.log(`[Webhook] Deleted from storage: ${item.file_path}`);
        } catch (storageErr) {
          console.error(`[Webhook] Failed to delete from storage: ${item.file_path}`, storageErr);
        }
        
        // Delete the record
        const { error: deleteError } = await supabase
          .from("vendor_bill_attachments")
          .delete()
          .eq("id", item.id);
        
        if (deleteError) {
          console.error(`[Webhook] Failed to delete attachment record ${item.id}:`, deleteError);
        } else {
          console.log(`[Webhook] Deleted attachment record ${item.id}`);
        }
      }
      
      // Log the reconciliation
      try {
        await supabase.from("quickbooks_sync_log").insert({
          entity_type: "bill_attachment",
          entity_id: localBillId,
          action: "webhook_reconcile_delete",
          status: "success",
          details: JSON.stringify({
            qb_bill_id: qbBillId,
            qb_attachable_ids: Array.from(qbAttachableIds),
            deleted_attachments: toDelete.map(d => ({ id: d.id, reason: d.reason })),
          }),
        });
      } catch (logErr) {
        console.error("[Webhook] Failed to log reconciliation:", logErr);
      }
    } else {
      console.log("[Webhook] All local attachments still exist in QuickBooks - no deletions needed");
    }
    
  } catch (error: any) {
    console.error("[Webhook] Error during attachment reconciliation:", error.message);
  }
}

// Fetch attachable (attachment) from QuickBooks
async function fetchQBAttachable(attachableId: string, accessToken: string, realmId: string) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/attachable/${attachableId}?minorversion=65`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch QB attachable: ${errorText}`);
  }

  const data = await response.json();
  return data.Attachable;
}

// Process a single attachable (attachment) update from QuickBooks
async function processAttachableUpdate(
  supabase: any,
  qbAttachableId: string,
  operation: string,
  accessToken: string,
  realmId: string
) {
  console.log(`[Webhook] Processing attachable ${qbAttachableId}, operation: ${operation}`);

  // Handle Delete operation - delete the local attachment
  if (operation === "Delete") {
    console.log("[Webhook] Attachable deleted in QB, attempting to delete locally...");
    
    // Find the sync log for this attachable
    // Use text cast since details is JSONB and we need to search for the qb_attachable_id
    const { data: syncLog } = await supabase
      .from("quickbooks_sync_log")
      .select("entity_id, details")
      .eq("entity_type", "bill_attachment")
      .or(`details.cs.{"qb_attachable_id":"${qbAttachableId}"},details::text.ilike.%${qbAttachableId}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    console.log(`[Webhook] Sync log lookup for attachable ${qbAttachableId}:`, syncLog ? "found" : "not found");
    
    let attachmentToDelete: { id: string; file_path: string } | null = null;
    let billIdForLog: string | null = null;
    
    if (syncLog?.entity_id) {
      // For attachments UPLOADED from CommandX, entity_id IS the attachment ID
      // Try direct lookup first
      const { data: directAttachment } = await supabase
        .from("vendor_bill_attachments")
        .select("id, file_path, bill_id")
        .eq("id", syncLog.entity_id)
        .maybeSingle();
      
      if (directAttachment) {
        attachmentToDelete = directAttachment;
        billIdForLog = directAttachment.bill_id;
        console.log(`[Webhook] Found attachment by direct ID lookup: ${directAttachment.id}`);
      } else {
        // entity_id might be the bill_id for attachments pulled FROM QB
        // Try to find by qb- prefix in file_path (for QB-sourced attachments)
        const { data: qbAttachments } = await supabase
          .from("vendor_bill_attachments")
          .select("id, file_path")
          .eq("bill_id", syncLog.entity_id)
          .ilike("file_path", `%qb-${qbAttachableId}%`);
        
        if (qbAttachments && qbAttachments.length > 0) {
          attachmentToDelete = qbAttachments[0];
          billIdForLog = syncLog.entity_id;
          console.log(`[Webhook] Found attachment by qb- prefix: ${qbAttachments[0].id}`);
        } else if (syncLog.details) {
          // Fallback: parse details to find by bill_id and file_name
          // details is JSONB so it may already be an object or a string
          try {
            const details = typeof syncLog.details === 'string' 
              ? JSON.parse(syncLog.details) 
              : syncLog.details;
            console.log(`[Webhook] Parsed details for fallback lookup:`, details);
            if (details.bill_id && details.file_name) {
              const { data: matchByName } = await supabase
                .from("vendor_bill_attachments")
                .select("id, file_path")
                .eq("bill_id", details.bill_id)
                .eq("file_name", details.file_name)
                .maybeSingle();
              
              if (matchByName) {
                attachmentToDelete = matchByName;
                billIdForLog = details.bill_id;
                console.log(`[Webhook] Found attachment by file_name: ${matchByName.id}`);
              }
            }
          } catch (parseErr) {
            console.error("[Webhook] Failed to parse sync log details:", parseErr);
          }
        }
      }
    }
    
    if (attachmentToDelete) {
      // Delete from storage first
      try {
        await supabase.storage
          .from("document-attachments")
          .remove([attachmentToDelete.file_path]);
        console.log(`[Webhook] Deleted from storage: ${attachmentToDelete.file_path}`);
      } catch (storageErr) {
        console.error("[Webhook] Failed to delete from storage:", storageErr);
      }
      
      // Delete the record
      await supabase
        .from("vendor_bill_attachments")
        .delete()
        .eq("id", attachmentToDelete.id);
      
      console.log(`[Webhook] Deleted local attachment ${attachmentToDelete.id} (from QB delete)`);
      
      // Log the sync
      try {
        await supabase.from("quickbooks_sync_log").insert({
          entity_type: "bill_attachment",
          entity_id: billIdForLog || attachmentToDelete.id,
          action: "webhook_delete",
          status: "success",
          details: JSON.stringify({ qb_attachable_id: qbAttachableId, deleted_attachment_id: attachmentToDelete.id }),
        });
      } catch (logErr) {
        console.error("[Webhook] Failed to log delete:", logErr);
      }
      
      return { success: true, action: "deleted", attachableId: qbAttachableId };
    }
    
    console.log("[Webhook] No matching local attachment found for QB delete");
    return { success: true, skipped: true, reason: "No local attachment to delete" };
  }

  // Fetch the full attachable from QuickBooks
  const qbAttachable = await fetchQBAttachable(qbAttachableId, accessToken, realmId);
  
  // Check if this attachment is linked to a Bill
  const billRef = qbAttachable.AttachableRef?.find(
    (ref: any) => ref.EntityRef?.type === "Bill"
  );
  
  if (!billRef) {
    console.log("[Webhook] Attachable not linked to a Bill, skipping");
    return { success: true, skipped: true, reason: "Not a bill attachment" };
  }

  const qbBillId = billRef.EntityRef.value;

  // Find the local bill mapping
  const { data: billMapping, error: mappingError } = await supabase
    .from("quickbooks_bill_mappings")
    .select("bill_id")
    .eq("quickbooks_bill_id", qbBillId)
    .maybeSingle();

  if (mappingError || !billMapping) {
    console.log(`[Webhook] No local bill found for QB bill ${qbBillId}`);
    return { success: true, skipped: true, reason: "No local bill mapping" };
  }

  const localBillId = billMapping.bill_id;

  // Check if we already have this attachment (by file name to prevent duplicates)
  const { data: existingAttachment } = await supabase
    .from("vendor_bill_attachments")
    .select("id")
    .eq("bill_id", localBillId)
    .eq("file_name", qbAttachable.FileName)
    .maybeSingle();

  if (existingAttachment) {
    console.log("[Webhook] Attachment already exists locally, skipping");
    return { success: true, skipped: true, reason: "Already exists" };
  }

  // Download the attachment from QuickBooks
  if (!qbAttachable.TempDownloadUri) {
    console.log("[Webhook] No download URI for attachable, skipping");
    return { success: true, skipped: true, reason: "No download URI" };
  }

  try {
    const fileResponse = await fetch(qbAttachable.TempDownloadUri);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download attachment: ${fileResponse.status}`);
    }

    const fileBlob = await fileResponse.blob();
    const fileBuffer = await fileBlob.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    // Generate storage path with qb- prefix to identify QB-sourced attachments
    const fileExt = qbAttachable.FileName?.split('.').pop() || 'bin';
    const storagePath = `vendor_bill/${localBillId}/${Date.now()}-qb-${qbAttachableId}.${fileExt}`;

    // Upload to Supabase storage using Blob for better SDK compatibility
    console.log(`[Webhook] Uploading attachment to storage: ${storagePath}`);
    const uploadBlob = new Blob([fileBytes], { type: qbAttachable.ContentType || 'application/octet-stream' });
    const { error: uploadError } = await supabase.storage
      .from('document-attachments')
      .upload(storagePath, uploadBlob, {
        contentType: qbAttachable.ContentType || 'application/octet-stream',
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }
    console.log(`[Webhook] Successfully uploaded attachment to storage: ${storagePath}`);

    // Create attachment record
    const { error: insertError } = await supabase
      .from("vendor_bill_attachments")
      .insert({
        bill_id: localBillId,
        file_name: qbAttachable.FileName,
        file_path: storagePath,
        file_type: qbAttachable.ContentType || 'application/octet-stream',
        file_size: qbAttachable.Size || fileBytes.length,
        uploaded_by: null, // From QuickBooks
      });

    if (insertError) {
      throw new Error(`Failed to insert attachment record: ${insertError.message}`);
    }

    // Log the sync (wrapped in try/catch to not break webhook processing)
    try {
      await supabase.from("quickbooks_sync_log").insert({
        entity_type: "bill_attachment",
        entity_id: localBillId,
        action: "webhook_create",
        status: "success",
        error_message: null,
        details: JSON.stringify({
          qb_attachable_id: qbAttachableId,
          qb_bill_id: qbBillId,
          file_name: qbAttachable.FileName,
        }),
      });
    } catch (logError) {
      console.error("[Webhook] Failed to log sync, continuing:", logError);
    }

    console.log(`[Webhook] Created attachment from QB: ${qbAttachable.FileName}`);
    return { success: true, action: "created", billId: localBillId };

  } catch (downloadError: any) {
    console.error("[Webhook] Failed to download/store attachment:", downloadError.message);
    
    // Log the error (wrapped in try/catch to not break webhook processing)
    try {
      await supabase.from("quickbooks_sync_log").insert({
        entity_type: "bill_attachment",
        entity_id: localBillId,
        action: "webhook_create",
        status: "error",
        error_message: downloadError.message,
        details: JSON.stringify({
          qb_attachable_id: qbAttachableId,
          qb_bill_id: qbBillId,
        }),
      });
    } catch (logError) {
      console.error("[Webhook] Failed to log error, continuing:", logError);
    }
    
    return { success: false, error: downloadError.message };
  }
}

// Map QB estimate status to local status
function mapQbStatusToLocal(txnStatus: string | undefined): string {
  switch (txnStatus) {
    case "Accepted":
      return "approved";
    case "Closed":
      return "closed";
    case "Rejected":
      return "rejected";
    case "Pending":
    default:
      return "sent";
  }
}

// Map QB bill balance to local status
function mapQbBillStatusToLocal(balance: number, totalAmt: number): string {
  if (balance === 0 && totalAmt > 0) {
    return "paid";
  } else if (balance < totalAmt && balance > 0) {
    return "partially_paid";
  }
  return "open";
}

// Map QB invoice balance to local status
function mapQbInvoiceStatusToLocal(balance: number, totalAmt: number, dueDate?: string): string {
  if (balance === 0 && totalAmt > 0) {
    return "paid";
  } else if (balance < totalAmt && balance > 0) {
    return "partially_paid";
  }
  // Check if overdue (past due date and still has balance)
  if (dueDate && balance > 0) {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due < today) {
      return "overdue";
    }
  }
  return "sent";
}

// Process a single customer update from QuickBooks
async function processCustomerUpdate(
  supabase: any,
  qbCustomerId: string,
  operation: string,
  accessToken: string,
  realmId: string
) {
  console.log(`[Webhook] Processing customer ${qbCustomerId}, operation: ${operation}`);

  // Find the local mapping
  const { data: mapping, error: mappingError } = await supabase
    .from("quickbooks_customer_mappings")
    .select("*, customers:customer_id(*)")
    .eq("quickbooks_customer_id", qbCustomerId)
    .maybeSingle();

  if (mappingError) {
    console.error("[Webhook] Error finding customer mapping:", mappingError);
    return { success: false, error: mappingError.message };
  }

  // Handle Delete/Void operations
  if (operation === "Delete" || operation === "Void") {
    if (!mapping) {
      console.log("[Webhook] No local mapping found for deleted QB customer:", qbCustomerId);
      return { success: true, skipped: true, reason: "No local mapping" };
    }

    // Soft-delete the local customer
    const { error: deleteError } = await supabase
      .from("customers")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", mapping.customer_id);

    if (deleteError) {
      console.error("[Webhook] Error soft-deleting customer:", deleteError);
      return { success: false, error: deleteError.message };
    }

    // Update mapping status
    await supabase
      .from("quickbooks_customer_mappings")
      .update({
        sync_status: "deleted",
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", mapping.id);

    // Log the sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "customer",
      entity_id: mapping.customer_id,
      action: "webhook_delete",
      status: "success",
      details: {
        qb_customer_id: qbCustomerId,
        operation,
      },
    });

    console.log("[Webhook] Soft-deleted customer from QB webhook:", mapping.customer_id);
    return { success: true, action: "deleted", customerId: mapping.customer_id };
  }

  // Fetch the full customer from QuickBooks
  const qbCustomer = await fetchQBCustomer(qbCustomerId, accessToken, realmId);
  console.log("[Webhook] Fetched QB customer:", qbCustomer.DisplayName);

  // Build address from QB BillAddr
  let address = null;
  if (qbCustomer.BillAddr) {
    const addr = qbCustomer.BillAddr;
    const parts = [
      addr.Line1,
      addr.Line2,
      addr.City,
      addr.CountrySubDivisionCode,
      addr.PostalCode,
    ].filter(Boolean);
    address = parts.join(", ");
  }

  // Determine customer type from QB Job field
  const customerType = qbCustomer.Job ? "commercial" : "residential";

  // Extract email - use fallback if not provided
  let email = qbCustomer.PrimaryEmailAddr?.Address;
  if (!email) {
    email = `qb-${qbCustomerId}@quickbooks.imported`;
  }

  if (!mapping) {
    // No local mapping exists - create new customer in Command X
    console.log("[Webhook] Creating new customer from QuickBooks:", qbCustomer.DisplayName);

    // Check if email already exists (to prevent duplicates)
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id, email")
      .eq("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingCustomer) {
      console.log("[Webhook] Customer with this email already exists, creating mapping only");
      
      // Just create mapping to existing customer
      await supabase.from("quickbooks_customer_mappings").insert({
        customer_id: existingCustomer.id,
        quickbooks_customer_id: qbCustomerId,
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
      });

      return { success: true, action: "mapped_existing", customerId: existingCustomer.id };
    }

    // Create new customer
    const { data: newCustomer, error: insertError } = await supabase
      .from("customers")
      .insert({
        name: qbCustomer.DisplayName,
        email: email,
        phone: qbCustomer.PrimaryPhone?.FreeFormNumber || null,
        company: qbCustomer.CompanyName || null,
        address: address,
        notes: qbCustomer.Notes || null,
        customer_type: customerType,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Webhook] Error creating customer:", insertError);
      return { success: false, error: insertError.message };
    }

    // Create the mapping
    await supabase.from("quickbooks_customer_mappings").insert({
      customer_id: newCustomer.id,
      quickbooks_customer_id: qbCustomerId,
      sync_status: "synced",
      last_synced_at: new Date().toISOString(),
    });

    // Log the sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "customer",
      entity_id: newCustomer.id,
      action: "webhook_create",
      status: "success",
      details: {
        qb_customer_id: qbCustomerId,
        qb_display_name: qbCustomer.DisplayName,
        operation,
      },
    });

    console.log("[Webhook] Created new customer from QB:", newCustomer.id);
    return { success: true, action: "created", customerId: newCustomer.id };
  }

  // Mapping exists - check for conflict detection
  const qbLastUpdated = new Date(qbCustomer.MetaData.LastUpdatedTime);
  const localLastSynced = mapping.last_synced_at ? new Date(mapping.last_synced_at) : null;

  // Check if QB is actually newer than our last sync
  if (localLastSynced && qbLastUpdated <= localLastSynced) {
    console.log("[Webhook] QB customer is not newer than local, skipping");
    return { success: true, skipped: true, reason: "Local is up to date" };
  }

  // Update the local customer
  const customerUpdate = {
    name: qbCustomer.DisplayName,
    phone: qbCustomer.PrimaryPhone?.FreeFormNumber || mapping.customers?.phone,
    company: qbCustomer.CompanyName || mapping.customers?.company,
    address: address || mapping.customers?.address,
    notes: qbCustomer.Notes || mapping.customers?.notes,
    customer_type: customerType,
    updated_at: new Date().toISOString(),
  };

  // Only update email if it's a real email (not the placeholder)
  if (qbCustomer.PrimaryEmailAddr?.Address) {
    (customerUpdate as any).email = qbCustomer.PrimaryEmailAddr.Address;
  }

  const { error: updateError } = await supabase
    .from("customers")
    .update(customerUpdate)
    .eq("id", mapping.customer_id);

  if (updateError) {
    console.error("[Webhook] Error updating customer:", updateError);
    return { success: false, error: updateError.message };
  }

  // Update the mapping
  await supabase
    .from("quickbooks_customer_mappings")
    .update({
      last_synced_at: new Date().toISOString(),
      sync_status: "synced",
    })
    .eq("id", mapping.id);

  // Log the sync
  await supabase.from("quickbooks_sync_log").insert({
    entity_type: "customer",
    entity_id: mapping.customer_id,
    action: "webhook_update",
    status: "success",
    details: {
      qb_customer_id: qbCustomerId,
      qb_display_name: qbCustomer.DisplayName,
      operation,
      fields_updated: Object.keys(customerUpdate),
    },
  });

  console.log("[Webhook] Successfully updated customer from QB:", mapping.customer_id);
  return { success: true, action: "updated", customerId: mapping.customer_id };
}

// Process a single vendor update from QuickBooks
async function processVendorUpdate(
  supabase: any,
  qbVendorId: string,
  operation: string,
  accessToken: string,
  realmId: string
) {
  console.log(`[Webhook] Processing vendor ${qbVendorId}, operation: ${operation}`);

  // Find the local mapping
  const { data: mapping, error: mappingError } = await supabase
    .from("quickbooks_vendor_mappings")
    .select("*, vendors:vendor_id(*)")
    .eq("quickbooks_vendor_id", qbVendorId)
    .maybeSingle();

  if (mappingError) {
    console.error("[Webhook] Error finding vendor mapping:", mappingError);
    return { success: false, error: mappingError.message };
  }

  // Handle Delete/Void operations
  if (operation === "Delete" || operation === "Void") {
    if (!mapping) {
      console.log("[Webhook] No local mapping found for deleted QB vendor:", qbVendorId);
      return { success: true, skipped: true, reason: "No local mapping" };
    }

    // Soft-delete the local vendor
    const { error: deleteError } = await supabase
      .from("vendors")
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", mapping.vendor_id);

    if (deleteError) {
      console.error("[Webhook] Error soft-deleting vendor:", deleteError);
      return { success: false, error: deleteError.message };
    }

    // Update mapping status
    await supabase
      .from("quickbooks_vendor_mappings")
      .update({
        sync_status: "deleted",
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", mapping.id);

    // Log the sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "vendor",
      entity_id: mapping.vendor_id,
      action: "webhook_delete",
      status: "success",
      details: {
        qb_vendor_id: qbVendorId,
        operation,
      },
    });

    console.log("[Webhook] Soft-deleted vendor from QB webhook:", mapping.vendor_id);
    return { success: true, action: "deleted", vendorId: mapping.vendor_id };
  }

  // Fetch the full vendor from QuickBooks
  const qbVendor = await fetchQBVendor(qbVendorId, accessToken, realmId);
  console.log("[Webhook] Fetched QB vendor:", qbVendor.DisplayName);

  // Extract email - use fallback if not provided
  let email = qbVendor.PrimaryEmailAddr?.Address;
  if (!email) {
    email = `qb-vendor-${qbVendorId}@quickbooks.imported`;
  }

  // Build address components from QB BillAddr
  let address = null;
  let city = null;
  let state = null;
  let zip = null;
  if (qbVendor.BillAddr) {
    const addr = qbVendor.BillAddr;
    address = addr.Line1 || null;
    city = addr.City || null;
    state = addr.CountrySubDivisionCode || null;
    zip = addr.PostalCode || null;
  }

  if (!mapping) {
    // No local mapping exists - create new vendor in Command X
    console.log("[Webhook] Creating new vendor from QuickBooks:", qbVendor.DisplayName);

    // Check if email already exists (to prevent duplicates)
    const { data: existingVendor } = await supabase
      .from("vendors")
      .select("id, email")
      .eq("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingVendor) {
      console.log("[Webhook] Vendor with this email already exists, creating mapping only");
      
      // Just create mapping to existing vendor
      await supabase.from("quickbooks_vendor_mappings").insert({
        vendor_id: existingVendor.id,
        quickbooks_vendor_id: qbVendorId,
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
      });

      return { success: true, action: "mapped_existing", vendorId: existingVendor.id };
    }

    // Create new vendor
    const { data: newVendor, error: insertError } = await supabase
      .from("vendors")
      .insert({
        name: qbVendor.DisplayName,
        email: email,
        phone: qbVendor.PrimaryPhone?.FreeFormNumber || null,
        company: qbVendor.CompanyName || null,
        address: address,
        city: city,
        state: state,
        zip: zip,
        specialty: qbVendor.Notes || null,
        account_number: qbVendor.AcctNum || null,
        license_number: qbVendor.AcctNum || null,
        tax_id: qbVendor.TaxIdentifier || null,
        track_1099: qbVendor.Vendor1099 || false,
        billing_rate: qbVendor.BillRate ? parseFloat(qbVendor.BillRate) : null,
        status: "active",
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Webhook] Error creating vendor:", insertError);
      return { success: false, error: insertError.message };
    }

    // Create the mapping
    await supabase.from("quickbooks_vendor_mappings").insert({
      vendor_id: newVendor.id,
      quickbooks_vendor_id: qbVendorId,
      sync_status: "synced",
      last_synced_at: new Date().toISOString(),
    });

    // Log the sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "vendor",
      entity_id: newVendor.id,
      action: "webhook_create",
      status: "success",
      details: {
        qb_vendor_id: qbVendorId,
        qb_display_name: qbVendor.DisplayName,
        operation,
      },
    });

    console.log("[Webhook] Created new vendor from QB:", newVendor.id);
    return { success: true, action: "created", vendorId: newVendor.id };
  }

  // Mapping exists - check for conflict detection
  const qbLastUpdated = new Date(qbVendor.MetaData.LastUpdatedTime);
  const localLastSynced = mapping.last_synced_at ? new Date(mapping.last_synced_at) : null;

  // Check if QB is actually newer than our last sync
  if (localLastSynced && qbLastUpdated <= localLastSynced) {
    console.log("[Webhook] QB vendor is not newer than local, skipping");
    return { success: true, skipped: true, reason: "Local is up to date" };
  }

  // Update the local vendor
  const vendorUpdate: Record<string, any> = {
    name: qbVendor.DisplayName,
    phone: qbVendor.PrimaryPhone?.FreeFormNumber || mapping.vendors?.phone,
    company: qbVendor.CompanyName || mapping.vendors?.company,
    address: address || mapping.vendors?.address,
    city: city || mapping.vendors?.city,
    state: state || mapping.vendors?.state,
    zip: zip || mapping.vendors?.zip,
    specialty: qbVendor.Notes || mapping.vendors?.specialty,
    account_number: qbVendor.AcctNum || mapping.vendors?.account_number,
    tax_id: qbVendor.TaxIdentifier || mapping.vendors?.tax_id,
    track_1099: qbVendor.Vendor1099 ?? mapping.vendors?.track_1099,
    updated_at: new Date().toISOString(),
  };

  // Only update email if it's a real email (not the placeholder)
  if (qbVendor.PrimaryEmailAddr?.Address) {
    vendorUpdate.email = qbVendor.PrimaryEmailAddr.Address;
  }

  // Update billing rate if provided
  if (qbVendor.BillRate) {
    vendorUpdate.billing_rate = parseFloat(qbVendor.BillRate);
  }

  const { error: updateError } = await supabase
    .from("vendors")
    .update(vendorUpdate)
    .eq("id", mapping.vendor_id);

  if (updateError) {
    console.error("[Webhook] Error updating vendor:", updateError);
    return { success: false, error: updateError.message };
  }

  // Update the mapping
  await supabase
    .from("quickbooks_vendor_mappings")
    .update({
      last_synced_at: new Date().toISOString(),
      sync_status: "synced",
    })
    .eq("id", mapping.id);

  // Log the sync
  await supabase.from("quickbooks_sync_log").insert({
    entity_type: "vendor",
    entity_id: mapping.vendor_id,
    action: "webhook_update",
    status: "success",
    details: {
      qb_vendor_id: qbVendorId,
      qb_display_name: qbVendor.DisplayName,
      operation,
      fields_updated: Object.keys(vendorUpdate),
    },
  });

  console.log("[Webhook] Successfully updated vendor from QB:", mapping.vendor_id);
  return { success: true, action: "updated", vendorId: mapping.vendor_id };
}

// Process a single estimate update from QuickBooks
async function processEstimateUpdate(
  supabase: any,
  qbEstimateId: string,
  operation: string,
  accessToken: string,
  realmId: string
) {
  console.log(`[Webhook] Processing estimate ${qbEstimateId}, operation: ${operation}`);

  // Find the local mapping
  const { data: mapping, error: mappingError } = await supabase
    .from("quickbooks_estimate_mappings")
    .select("*, estimates(*)")
    .eq("quickbooks_estimate_id", qbEstimateId)
    .maybeSingle();

  if (mappingError) {
    console.error("[Webhook] Error finding mapping:", mappingError);
    return { success: false, error: mappingError.message };
  }

  if (!mapping) {
    console.log("[Webhook] No local mapping found for QB estimate:", qbEstimateId);
    // This estimate exists in QB but not in Command X - could trigger an import
    return { success: true, skipped: true, reason: "No local mapping" };
  }

  if (operation === "Delete" || operation === "Void") {
    // Mark the mapping as voided
    await supabase
      .from("quickbooks_estimate_mappings")
      .update({
        sync_status: "voided",
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", mapping.id);

    // Soft-delete the local estimate
    const { error: deleteError } = await supabase
      .from("estimates")
      .update({
        deleted_at: new Date().toISOString(),
        status: "closed",
      })
      .eq("id", mapping.estimate_id)
      .is("deleted_at", null);

    if (deleteError) {
      console.error("[Webhook] Error soft-deleting estimate:", deleteError);
    }

    console.log("[Webhook] Soft-deleted estimate from QB:", mapping.estimate_id);
    return { success: true, action: "deleted" };
  }

  // Fetch the full estimate from QuickBooks
  const qbEstimate = await fetchQBEstimate(qbEstimateId, accessToken, realmId);
  console.log("[Webhook] Fetched QB estimate:", qbEstimate.DocNumber);

  // Get QB last updated time
  const qbLastUpdated = new Date(qbEstimate.MetaData.LastUpdatedTime);
  const localLastSynced = mapping.last_synced_at ? new Date(mapping.last_synced_at) : null;

  // Check if QB is actually newer
  if (localLastSynced && qbLastUpdated <= localLastSynced) {
    console.log("[Webhook] QB estimate is not newer than local, skipping");
    return { success: true, skipped: true, reason: "Local is up to date" };
  }

  // Update the local estimate
  const estimateUpdate = {
    notes: qbEstimate.CustomerMemo?.value || null,
    status: mapQbStatusToLocal(qbEstimate.TxnStatus),
    subtotal: parseFloat(qbEstimate.TotalAmt || "0") - parseFloat(qbEstimate.TxnTaxDetail?.TotalTax || "0"),
    tax_amount: parseFloat(qbEstimate.TxnTaxDetail?.TotalTax || "0"),
    total: parseFloat(qbEstimate.TotalAmt || "0"),
    valid_until: qbEstimate.ExpirationDate || mapping.estimates?.valid_until,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("estimates")
    .update(estimateUpdate)
    .eq("id", mapping.estimate_id);

  if (updateError) {
    console.error("[Webhook] Error updating estimate:", updateError);
    return { success: false, error: updateError.message };
  }

  // Update line items - delete existing and insert new
  await supabase
    .from("estimate_line_items")
    .delete()
    .eq("estimate_id", mapping.estimate_id);

  if (qbEstimate.Line && qbEstimate.Line.length > 0) {
    const lineItems = [];
    let sortOrder = 0;

    for (const line of qbEstimate.Line) {
      if (line.DetailType === "SalesItemLineDetail" && line.SalesItemLineDetail) {
        const detail = line.SalesItemLineDetail;
        
        // Try to find matching product by QB item ID
        let productId = null;
        if (detail.ItemRef?.value) {
          const { data: productMapping } = await supabase
            .from("quickbooks_product_mappings")
            .select("product_id")
            .eq("quickbooks_item_id", detail.ItemRef.value)
            .maybeSingle();
          
          if (productMapping) {
            productId = productMapping.product_id;
          }
        }

        lineItems.push({
          estimate_id: mapping.estimate_id,
          product_id: productId,
          product_name: detail.ItemRef?.name || null,
          description: line.Description || detail.ItemRef?.name || "Item",
          quantity: detail.Qty || 1,
          unit_price: parseFloat(detail.UnitPrice || "0"),
          markup: 0,
          total: parseFloat(line.Amount || "0"),
          sort_order: sortOrder++,
          is_taxable: detail.TaxCodeRef?.value === "TAX",
        });
      }
    }

    if (lineItems.length > 0) {
      const { error: lineError } = await supabase
        .from("estimate_line_items")
        .insert(lineItems);

      if (lineError) {
        console.error("[Webhook] Error inserting line items:", lineError);
      }
    }
  }

  // Update the mapping
  await supabase
    .from("quickbooks_estimate_mappings")
    .update({
      last_synced_at: new Date().toISOString(),
      sync_status: "synced",
    })
    .eq("id", mapping.id);

  // Log the sync
  await supabase.from("quickbooks_sync_log").insert({
    entity_type: "estimate",
    entity_id: mapping.estimate_id,
    action: "webhook_update",
    status: "success",
    details: {
      qb_estimate_id: qbEstimateId,
      qb_doc_number: qbEstimate.DocNumber,
      operation,
    },
  });

  console.log("[Webhook] Successfully updated estimate from QB:", mapping.estimate_id);
  return { success: true, action: "updated", estimateId: mapping.estimate_id };
}

// Process a single invoice update from QuickBooks (primarily for deletion sync)
async function processInvoiceUpdate(
  supabase: any,
  qbInvoiceId: string,
  operation: string,
  accessToken: string,
  realmId: string
) {
  console.log(`[Webhook] Processing invoice ${qbInvoiceId}, operation: ${operation}`);

  // Find the local mapping
  const { data: mapping, error: mappingError } = await supabase
    .from("quickbooks_invoice_mappings")
    .select("*, invoices:invoice_id(*)")
    .eq("quickbooks_invoice_id", qbInvoiceId)
    .maybeSingle();

  if (mappingError) {
    console.error("[Webhook] Error finding invoice mapping:", mappingError);
    return { success: false, error: mappingError.message };
  }

  if (!mapping) {
    console.log("[Webhook] No local mapping found for QB invoice:", qbInvoiceId);
    return { success: true, skipped: true, reason: "No local mapping" };
  }

  if (operation === "Delete" || operation === "Void") {
    // Soft-delete the local invoice (set deleted_at)
    const { error: deleteError } = await supabase
      .from("invoices")
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", mapping.invoice_id);

    if (deleteError) {
      console.error("[Webhook] Error soft-deleting invoice:", deleteError);
      return { success: false, error: deleteError.message };
    }

    // Update mapping to reflect deleted status
    await supabase
      .from("quickbooks_invoice_mappings")
      .update({
        sync_status: "deleted",
        synced_at: new Date().toISOString(),
      })
      .eq("id", mapping.id);

    // Log the sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "invoice",
      entity_id: mapping.invoice_id,
      action: "webhook_delete",
      status: "success",
      details: {
        qb_invoice_id: qbInvoiceId,
        qb_doc_number: mapping.quickbooks_doc_number,
        operation,
      },
    });

    console.log("[Webhook] Soft-deleted invoice from QB webhook:", mapping.invoice_id);
    return { success: true, action: "deleted", invoiceId: mapping.invoice_id };
  }

  // For Create/Update operations - sync changes from QuickBooks
  console.log("[Webhook] Processing invoice create/update from QuickBooks");

  // Fetch the full invoice from QuickBooks
  const qbInvoice = await fetchQBInvoice(qbInvoiceId, accessToken, realmId);
  console.log("[Webhook] Fetched QB invoice:", qbInvoice.DocNumber);

  // Get QB last updated time for conflict detection
  const qbLastUpdated = new Date(qbInvoice.MetaData.LastUpdatedTime);
  const localLastSynced = mapping.synced_at ? new Date(mapping.synced_at) : null;

  // Check if QB is actually newer than our last sync
  if (localLastSynced && qbLastUpdated <= localLastSynced) {
    console.log("[Webhook] QB invoice is not newer than local, skipping");
    return { success: true, skipped: true, reason: "Local is up to date" };
  }

  // Calculate amounts from QB invoice
  const totalAmt = parseFloat(qbInvoice.TotalAmt || "0");
  const balance = parseFloat(qbInvoice.Balance || "0");
  const taxAmount = parseFloat(qbInvoice.TxnTaxDetail?.TotalTax || "0");
  const subtotal = totalAmt - taxAmount;
  const paidAmount = totalAmt - balance;

  // Update the local invoice
  const invoiceUpdate = {
    due_date: qbInvoice.DueDate || mapping.invoices?.due_date,
    notes: qbInvoice.PrivateNote || null,
    subtotal: subtotal,
    tax_amount: taxAmount,
    total: totalAmt,
    paid_amount: paidAmount,
    remaining_amount: balance,
    status: mapQbInvoiceStatusToLocal(balance, totalAmt, qbInvoice.DueDate),
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("invoices")
    .update(invoiceUpdate)
    .eq("id", mapping.invoice_id);

  if (updateError) {
    console.error("[Webhook] Error updating invoice:", updateError);
    return { success: false, error: updateError.message };
  }

  // Update line items - delete existing and insert new
  await supabase
    .from("invoice_line_items")
    .delete()
    .eq("invoice_id", mapping.invoice_id);

  if (qbInvoice.Line && qbInvoice.Line.length > 0) {
    const lineItems = [];
    let displayOrder = 0;

    for (const line of qbInvoice.Line) {
      if (line.DetailType === "SalesItemLineDetail" && line.SalesItemLineDetail) {
        const detail = line.SalesItemLineDetail;
        
        // Try to find matching product by QB item ID
        let productId = null;
        let productName = detail.ItemRef?.name || null;
        
        if (detail.ItemRef?.value) {
          const { data: productMapping } = await supabase
            .from("quickbooks_product_mappings")
            .select("product_id, products(name)")
            .eq("quickbooks_item_id", detail.ItemRef.value)
            .maybeSingle();
          
          if (productMapping) {
            productId = productMapping.product_id;
            // Use local product name if we have a mapping
            if (productMapping.products?.name) {
              productName = productMapping.products.name;
            }
          }
        }

        lineItems.push({
          invoice_id: mapping.invoice_id,
          product_id: productId,
          product_name: productName,
          description: line.Description || detail.ItemRef?.name || "Item",
          quantity: detail.Qty || 1,
          unit_price: parseFloat(detail.UnitPrice || "0"),
          markup: 0,
          total: parseFloat(line.Amount || "0"),
          display_order: displayOrder++,
        });
      }
    }

    if (lineItems.length > 0) {
      const { error: lineError } = await supabase
        .from("invoice_line_items")
        .insert(lineItems);

      if (lineError) {
        console.error("[Webhook] Error inserting invoice line items:", lineError);
      }
    }
  }

  // Update the mapping with new sync timestamp
  await supabase
    .from("quickbooks_invoice_mappings")
    .update({
      synced_at: new Date().toISOString(),
      sync_status: "synced",
      quickbooks_doc_number: qbInvoice.DocNumber,
    })
    .eq("id", mapping.id);

  // Log the sync action
  await supabase.from("quickbooks_sync_log").insert({
    entity_type: "invoice",
    entity_id: mapping.invoice_id,
    action: "webhook_update",
    status: "success",
    details: {
      qb_invoice_id: qbInvoiceId,
      qb_doc_number: qbInvoice.DocNumber,
      operation,
      fields_updated: ["due_date", "notes", "subtotal", "tax_amount", "total", "paid_amount", "remaining_amount", "status", "line_items"],
    },
  });

  console.log("[Webhook] Successfully updated invoice from QB:", mapping.invoice_id);
  return { success: true, action: "updated", invoiceId: mapping.invoice_id };
}

// Process a single bill update from QuickBooks
async function processBillUpdate(
  supabase: any,
  qbBillId: string,
  operation: string,
  accessToken: string,
  realmId: string
) {
  console.log(`[Webhook] Processing bill ${qbBillId}, operation: ${operation}`);

  // Find the local mapping
  const { data: mapping, error: mappingError } = await supabase
    .from("quickbooks_bill_mappings")
    .select("*, vendor_bills:bill_id(*)")
    .eq("quickbooks_bill_id", qbBillId)
    .maybeSingle();

  if (mappingError) {
    console.error("[Webhook] Error finding bill mapping:", mappingError);
    return { success: false, error: mappingError.message };
  }

  if (!mapping) {
    console.log("[Webhook] No local mapping found for QB bill:", qbBillId);
    // This bill exists in QB but not in Command X - could trigger an import
    return { success: true, skipped: true, reason: "No local mapping" };
  }

  if (operation === "Delete" || operation === "Void") {
    const billId = mapping.bill_id;
    console.log("[Webhook] Soft-deleting vendor bill from QB delete/void:", billId);
    
    // Soft-delete the bill to preserve historical data (payments, line items, attachments)
    const { error: softDeleteError } = await supabase
      .from("vendor_bills")
      .update({
        deleted_at: new Date().toISOString(),
        status: operation === "Void" ? "void" : "void",
        updated_at: new Date().toISOString(),
      })
      .eq("id", billId);
    
    if (softDeleteError) {
      console.error("[Webhook] Error soft-deleting vendor bill:", softDeleteError);
      return { success: false, error: softDeleteError.message };
    }
    
    // Mark the QB mapping as inactive but keep it for historical reference
    await supabase
      .from("quickbooks_bill_mappings")
      .update({
        sync_status: "deleted",
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", mapping.id);
    
    console.log("[Webhook] Soft-deleted vendor bill from QB:", billId);
    return { success: true, action: "soft_deleted" };
  }

  // Fetch the full bill from QuickBooks
  const qbBill = await fetchQBBill(qbBillId, accessToken, realmId);
  console.log("[Webhook] Fetched QB bill:", qbBill.DocNumber);

  // Get QB last updated time
  const qbLastUpdated = new Date(qbBill.MetaData.LastUpdatedTime);
  const localLastSynced = mapping.last_synced_at ? new Date(mapping.last_synced_at) : null;

  // Check if QB is actually newer
  if (localLastSynced && qbLastUpdated <= localLastSynced) {
    console.log("[Webhook] QB bill is not newer than local, skipping");
    return { success: true, skipped: true, reason: "Local is up to date" };
  }

  // Calculate totals from QB bill
  const totalAmt = parseFloat(qbBill.TotalAmt || "0");
  const balance = parseFloat(qbBill.Balance || "0");

  // Update the local vendor bill
  const billUpdate = {
    notes: qbBill.PrivateNote || null,
    bill_date: qbBill.TxnDate || mapping.vendor_bills?.bill_date,
    due_date: qbBill.DueDate || mapping.vendor_bills?.due_date,
    subtotal: totalAmt, // QB bills typically don't have separate tax
    total: totalAmt,
    remaining_amount: balance,
    paid_amount: totalAmt - balance,
    status: mapQbBillStatusToLocal(balance, totalAmt),
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("vendor_bills")
    .update(billUpdate)
    .eq("id", mapping.bill_id);

  if (updateError) {
    console.error("[Webhook] Error updating vendor bill:", updateError);
    return { success: false, error: updateError.message };
  }

  // Update line items - delete existing and insert new
  await supabase
    .from("vendor_bill_line_items")
    .delete()
    .eq("bill_id", mapping.bill_id);

  if (qbBill.Line && qbBill.Line.length > 0) {
    const lineItems = [];

    for (const line of qbBill.Line) {
      // Handle AccountBasedExpenseLineDetail (most common for bills)
      if (line.DetailType === "AccountBasedExpenseLineDetail" && line.AccountBasedExpenseLineDetail) {
        const detail = line.AccountBasedExpenseLineDetail;
        
        // Try to find matching expense category by account name
        let categoryId = null;
        if (detail.AccountRef?.name) {
          const { data: category } = await supabase
            .from("expense_categories")
            .select("id")
            .ilike("name", detail.AccountRef.name)
            .maybeSingle();
          
          if (category) {
            categoryId = category.id;
          }
        }

        lineItems.push({
          bill_id: mapping.bill_id,
          description: line.Description || detail.AccountRef?.name || "Expense",
          quantity: 1,
          unit_cost: parseFloat(line.Amount || "0"),
          total: parseFloat(line.Amount || "0"),
          category_id: categoryId,
        });
      }
      // Handle ItemBasedExpenseLineDetail (items/products)
      else if (line.DetailType === "ItemBasedExpenseLineDetail" && line.ItemBasedExpenseLineDetail) {
        const detail = line.ItemBasedExpenseLineDetail;
        
        lineItems.push({
          bill_id: mapping.bill_id,
          description: line.Description || detail.ItemRef?.name || "Item",
          quantity: detail.Qty || 1,
          unit_cost: parseFloat(detail.UnitPrice || line.Amount || "0"),
          total: parseFloat(line.Amount || "0"),
        });
      }
    }

    if (lineItems.length > 0) {
      const { error: lineError } = await supabase
        .from("vendor_bill_line_items")
        .insert(lineItems);

      if (lineError) {
        console.error("[Webhook] Error inserting bill line items:", lineError);
      }
    }
  }

  // Update the mapping
  await supabase
    .from("quickbooks_bill_mappings")
    .update({
      last_synced_at: new Date().toISOString(),
      sync_status: "synced",
      quickbooks_doc_number: qbBill.DocNumber,
    })
    .eq("id", mapping.id);

  // Log the sync
  await supabase.from("quickbooks_sync_log").insert({
    entity_type: "vendor_bill",
    entity_id: mapping.bill_id,
    action: "webhook_update",
    status: "success",
    details: {
      qb_bill_id: qbBillId,
      qb_doc_number: qbBill.DocNumber,
      operation,
    },
  });

  // Reconcile attachments - delete any that no longer exist in QuickBooks
  await reconcileBillAttachments(supabase, mapping.bill_id, qbBillId, accessToken, realmId);

  console.log("[Webhook] Successfully updated vendor bill from QB:", mapping.bill_id);
  return { success: true, action: "updated", billId: mapping.bill_id };
}

// Fetch bill payment from QuickBooks
async function fetchQBBillPayment(billPaymentId: string, accessToken: string, realmId: string) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/billpayment/${billPaymentId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch QB bill payment: ${errorText}`);
  }

  const data = await response.json();
  return data.BillPayment;
}

// Map QB payment type to local payment method
function mapQbPaymentTypeToLocal(payType: string): string {
  switch (payType?.toLowerCase()) {
    case "check":
      return "Check";
    case "creditcard":
      return "Credit Card";
    default:
      return "ACH"; // Default for electronic payments
  }
}

// Process a single bill payment update from QuickBooks
async function processBillPaymentUpdate(
  supabase: any,
  qbBillPaymentId: string,
  operation: string,
  accessToken: string,
  realmId: string
) {
  console.log(`[Webhook] Processing bill payment ${qbBillPaymentId}, operation: ${operation}`);

  // Handle Delete/Void operations - find and remove any linked payments
  if (operation === "Delete" || operation === "Void") {
    const { data: existingPayments, error: findError } = await supabase
      .from("vendor_bill_payments")
      .select("id, bill_id")
      .eq("quickbooks_payment_id", qbBillPaymentId);

    if (findError) {
      console.error("[Webhook] Error finding payment by QB ID:", findError);
      return { success: false, error: findError.message };
    }

    if (!existingPayments || existingPayments.length === 0) {
      console.log("[Webhook] No local payment found for deleted QB payment:", qbBillPaymentId);
      return { success: true, skipped: true, reason: "No local payment" };
    }

    // Delete payment attachments first
    const paymentIds = existingPayments.map((p: any) => p.id);
    await supabase
      .from("vendor_bill_payment_attachments")
      .delete()
      .in("payment_id", paymentIds);

    // Delete the payments
    const { error: deleteError } = await supabase
      .from("vendor_bill_payments")
      .delete()
      .eq("quickbooks_payment_id", qbBillPaymentId);

    if (deleteError) {
      console.error("[Webhook] Error deleting payment:", deleteError);
      return { success: false, error: deleteError.message };
    }

    // Recalculate bill totals for affected bills
    for (const payment of existingPayments) {
      await recalculateBillTotals(supabase, payment.bill_id);
    }

    // Log the sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "bill_payment",
      entity_id: qbBillPaymentId,
      action: "webhook_delete",
      status: "success",
      details: {
        qb_payment_id: qbBillPaymentId,
        operation,
        deleted_count: existingPayments.length,
      },
    });

    console.log("[Webhook] Deleted bill payment from QB:", qbBillPaymentId);
    return { success: true, action: "deleted", count: existingPayments.length };
  }

  // Fetch the full bill payment from QuickBooks
  const qbPayment = await fetchQBBillPayment(qbBillPaymentId, accessToken, realmId);
  console.log("[Webhook] Fetched QB bill payment:", qbPayment.Id, "Total:", qbPayment.TotalAmt);

  const results = [];

  // Process each line item (a BillPayment can cover multiple bills)
  for (const line of qbPayment.Line || []) {
    // Find linked bill transactions
    for (const linkedTxn of line.LinkedTxn || []) {
      if (linkedTxn.TxnType !== "Bill") {
        continue;
      }

      const qbBillId = linkedTxn.TxnId;
      const paymentAmount = parseFloat(line.Amount || "0");

      // Find the local bill mapping
      const { data: billMapping, error: mappingError } = await supabase
        .from("quickbooks_bill_mappings")
        .select("bill_id")
        .eq("quickbooks_bill_id", qbBillId)
        .maybeSingle();

      if (mappingError || !billMapping) {
        console.log(`[Webhook] No local mapping for QB bill ${qbBillId}, skipping payment`);
        continue;
      }

      const localBillId = billMapping.bill_id;

      // Check if this payment already exists (by QB payment ID and bill)
      const { data: existingPayment } = await supabase
        .from("vendor_bill_payments")
        .select("id")
        .eq("quickbooks_payment_id", qbBillPaymentId)
        .eq("bill_id", localBillId)
        .maybeSingle();

      if (existingPayment) {
        // Update existing payment
        const { error: updateError } = await supabase
          .from("vendor_bill_payments")
          .update({
            payment_date: qbPayment.TxnDate,
            amount: paymentAmount,
            payment_method: mapQbPaymentTypeToLocal(qbPayment.PayType),
            reference_number: qbPayment.DocNumber || null,
            notes: qbPayment.PrivateNote || null,
          })
          .eq("id", existingPayment.id);

        if (updateError) {
          console.error("[Webhook] Error updating payment:", updateError);
          results.push({ billId: localBillId, success: false, error: updateError.message });
        } else {
          await recalculateBillTotals(supabase, localBillId);
          results.push({ billId: localBillId, success: true, action: "updated", paymentId: existingPayment.id });
        }
      } else {
        // SMART MATCHING: Check for existing unlinked payment in Command X
        // This handles the case where user records payment locally, then accountant records in QuickBooks later
        const { data: unlinkedPayments } = await supabase
          .from("vendor_bill_payments")
          .select("id, payment_date, amount, notes")
          .eq("bill_id", localBillId)
          .is("quickbooks_payment_id", null) // No QB link yet
          .order("payment_date", { ascending: false });

        // Find a match: same amount (within $0.01), within 14 days
        const qbPaymentDate = new Date(qbPayment.TxnDate);
        const matchingPayment = unlinkedPayments?.find((p: any) => {
          const amountMatch = Math.abs(parseFloat(p.amount) - paymentAmount) < 0.01;
          const localPaymentDate = new Date(p.payment_date);
          const daysDiff = Math.abs(qbPaymentDate.getTime() - localPaymentDate.getTime()) / (1000 * 60 * 60 * 24);
          return amountMatch && daysDiff <= 14;
        });

        if (matchingPayment) {
          // LINK existing Command X payment to QuickBooks (prevents duplicate!)
          const existingNotes = matchingPayment.notes || '';
          const updatedNotes = existingNotes.includes('[Linked to QB]') 
            ? existingNotes 
            : `${existingNotes} [Linked to QB]`.trim();

          const { error: linkError } = await supabase
            .from("vendor_bill_payments")
            .update({
              quickbooks_payment_id: qbBillPaymentId,
              notes: updatedNotes,
            })
            .eq("id", matchingPayment.id);

          if (linkError) {
            console.error("[Webhook] Error linking payment:", linkError);
            results.push({ billId: localBillId, success: false, error: linkError.message });
          } else {
            console.log("[Webhook] Linked existing payment to QB:", matchingPayment.id, "->", qbBillPaymentId);
            results.push({ billId: localBillId, success: true, action: "linked", paymentId: matchingPayment.id });
          }
        } else {
          // No matching unlinked payment found - create new (accountant recorded first)
          const { data: newPayment, error: insertError } = await supabase
            .from("vendor_bill_payments")
            .insert({
              bill_id: localBillId,
              payment_date: qbPayment.TxnDate,
              amount: paymentAmount,
              payment_method: mapQbPaymentTypeToLocal(qbPayment.PayType),
              reference_number: qbPayment.DocNumber || null,
              notes: qbPayment.PrivateNote || `Synced from QuickBooks`,
              quickbooks_payment_id: qbBillPaymentId,
            })
            .select()
            .single();

          if (insertError) {
            console.error("[Webhook] Error inserting payment:", insertError);
            results.push({ billId: localBillId, success: false, error: insertError.message });
          } else {
            await recalculateBillTotals(supabase, localBillId);
            results.push({ billId: localBillId, success: true, action: "created", paymentId: newPayment.id });
          }
        }
      }
    }
  }

  // Log the sync
  await supabase.from("quickbooks_sync_log").insert({
    entity_type: "bill_payment",
    entity_id: qbBillPaymentId,
    action: "webhook_sync",
    status: results.every((r: any) => r.success) ? "success" : "partial",
    details: {
      qb_payment_id: qbBillPaymentId,
      qb_doc_number: qbPayment.DocNumber,
      operation,
      results,
    },
  });

  console.log("[Webhook] Processed bill payment from QB:", qbBillPaymentId, "Results:", results.length);
  return { success: true, action: "processed", results };
}

// Recalculate bill paid_amount and remaining_amount after payment changes
async function recalculateBillTotals(supabase: any, billId: string) {
  // Get all payments for this bill
  const { data: payments, error: paymentsError } = await supabase
    .from("vendor_bill_payments")
    .select("amount")
    .eq("bill_id", billId);

  if (paymentsError) {
    console.error("[Webhook] Error fetching payments for recalculation:", paymentsError);
    return;
  }

  const totalPaid = (payments || []).reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);

  // Get the bill total
  const { data: bill, error: billError } = await supabase
    .from("vendor_bills")
    .select("total")
    .eq("id", billId)
    .single();

  if (billError || !bill) {
    console.error("[Webhook] Error fetching bill for recalculation:", billError);
    return;
  }

  const billTotal = parseFloat(bill.total || 0);
  const remaining = Math.max(0, billTotal - totalPaid);

  // Determine new status
  let newStatus = "open";
  if (remaining === 0 && billTotal > 0) {
    newStatus = "paid";
  } else if (totalPaid > 0 && remaining > 0) {
    newStatus = "partially_paid";
  }

  // Update the bill
  const { error: updateError } = await supabase
    .from("vendor_bills")
    .update({
      paid_amount: totalPaid,
      remaining_amount: remaining,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", billId);

  if (updateError) {
    console.error("[Webhook] Error updating bill totals:", updateError);
  } else {
    console.log(`[Webhook] Recalculated bill ${billId}: paid=${totalPaid}, remaining=${remaining}, status=${newStatus}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // QuickBooks sends a challenge for webhook verification during setup
  if (req.method === "GET") {
    const url = new URL(req.url);
    const challenge = url.searchParams.get("challenge");
    if (challenge) {
      console.log("[Webhook] Responding to challenge verification");
      return new Response(challenge, {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const payload = await req.text();
    const signature = req.headers.get("intuit-signature");

    console.log("[Webhook] Received webhook, signature present:", !!signature);

    // Verify signature
    if (!signature || !await verifySignature(payload, signature)) {
      console.error("[Webhook] Invalid signature");
      return new Response("Invalid signature", { status: 401, headers: corsHeaders });
    }

    const webhookData: WebhookPayload = JSON.parse(payload);
    console.log("[Webhook] Payload parsed, notifications:", webhookData.eventNotifications?.length);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get valid token for API calls
    const { accessToken, realmId } = await getValidToken(supabase);

    const results = [];

    // Process each notification
    for (const notification of webhookData.eventNotifications || []) {
      // Verify realm ID matches our connected account
      if (notification.realmId !== realmId) {
        console.log("[Webhook] Realm ID mismatch, skipping");
        continue;
      }

      for (const entity of notification.dataChangeEvent?.entities || []) {
        if (entity.name === "Estimate") {
          const result = await processEstimateUpdate(
            supabase,
            entity.id,
            entity.operation,
            accessToken,
            realmId
          );
          results.push({ entityId: entity.id, entityType: "Estimate", ...result });
        } else if (entity.name === "Bill") {
          const result = await processBillUpdate(
            supabase,
            entity.id,
            entity.operation,
            accessToken,
            realmId
          );
          results.push({ entityId: entity.id, entityType: "Bill", ...result });
        } else if (entity.name === "Invoice") {
          const result = await processInvoiceUpdate(
            supabase,
            entity.id,
            entity.operation,
            accessToken,
            realmId
          );
          results.push({ entityId: entity.id, entityType: "Invoice", ...result });
        } else if (entity.name === "Customer") {
          const result = await processCustomerUpdate(
            supabase,
            entity.id,
            entity.operation,
            accessToken,
            realmId
          );
          results.push({ entityId: entity.id, entityType: "Customer", ...result });
        } else if (entity.name === "Vendor") {
          const result = await processVendorUpdate(
            supabase,
            entity.id,
            entity.operation,
            accessToken,
            realmId
          );
          results.push({ entityId: entity.id, entityType: "Vendor", ...result });
        } else if (entity.name === "BillPayment") {
          const result = await processBillPaymentUpdate(
            supabase,
            entity.id,
            entity.operation,
            accessToken,
            realmId
          );
          results.push({ entityId: entity.id, entityType: "BillPayment", ...result });
        } else if (entity.name === "Attachable") {
          const result = await processAttachableUpdate(
            supabase,
            entity.id,
            entity.operation,
            accessToken,
            realmId
          );
          results.push({ entityId: entity.id, entityType: "Attachable", ...result });
        } else {
          console.log(`[Webhook] Skipping unsupported entity type: ${entity.name}`);
        }
      }
    }

    console.log("[Webhook] Processing complete, results:", results.length);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // Still return 200 to prevent QuickBooks from retrying
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
