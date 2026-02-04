

# Fix Vendor Bill Attachment QuickBooks Sync

## Problem Summary

Two issues with vendor bill attachment synchronization to QuickBooks:

1. **Local-to-QuickBooks Sync (Editing existing bills)**: When attachments are added to an existing vendor bill during editing, they are not syncing to QuickBooks consistently
2. **QuickBooks-to-Local Sync (Bi-directional)**: Attachments added directly in QuickBooks are not syncing back to the app

---

## Root Cause Analysis

### Issue 1: Local-to-QuickBooks Sync

The current code in `useVendorBillAttachments.ts` already triggers `quickbooks-sync-bill-attachment` when uploading attachments to existing synced bills. However, after reviewing the code:

```typescript
// After inserting attachment record, check if bill is synced to QuickBooks
const { data: qbMapping } = await supabase
  .from("quickbooks_bill_mappings")
  .select("quickbooks_bill_id, sync_status")
  .eq("bill_id", billId)
  .maybeSingle();

if (qbMapping && qbMapping.sync_status === "synced" && qbMapping.quickbooks_bill_id) {
  // Trigger attachment sync to QuickBooks (non-blocking)
  supabase.functions.invoke("quickbooks-sync-bill-attachment", {...});
}
```

The logic appears correct. Potential issues to investigate:
- The edge function may be failing silently
- The Authorization header may not be forwarded correctly
- The sync might be running before the attachment is fully available in storage

### Issue 2: QuickBooks-to-Local Sync (NOT IMPLEMENTED)

The webhook handler in `quickbooks-webhook/index.ts` does not process `Attachable` entity changes from QuickBooks:

```typescript
for (const entity of notification.dataChangeEvent?.entities || []) {
  if (entity.name === "Estimate") { ... }
  else if (entity.name === "Bill") { ... }
  else if (entity.name === "Invoice") { ... }
  // ... other entities
  else {
    console.log(`[Webhook] Skipping unsupported entity type: ${entity.name}`);
  }
}
```

QuickBooks sends `Attachable` events when attachments are added/modified, but these are currently being skipped.

---

## Solution

### Part 1: Fix Local-to-QuickBooks Attachment Sync

**File: `src/integrations/supabase/hooks/useVendorBillAttachments.ts`**

Add better error handling and ensure the user's auth token is properly forwarded:

```typescript
// After uploading attachment to a synced bill, sync to QuickBooks
if (qbMapping && qbMapping.sync_status === "synced" && qbMapping.quickbooks_bill_id) {
  try {
    // Get current session to forward auth
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await supabase.functions.invoke("quickbooks-sync-bill-attachment", {
      body: {
        attachmentId: data.id,
        billId: billId,
        qbBillId: qbMapping.quickbooks_bill_id,
      },
      headers: session?.access_token ? {
        Authorization: `Bearer ${session.access_token}`
      } : undefined,
    });
    
    if (response.error) {
      console.warn("QuickBooks attachment sync failed:", response.error);
    } else if (response.data?.success) {
      console.log("Attachment synced to QuickBooks:", response.data.message);
    } else if (response.data?.error) {
      console.warn("QuickBooks attachment sync returned error:", response.data.error);
    }
  } catch (err) {
    console.warn("QuickBooks attachment sync error:", err);
  }
}
```

### Part 2: Add Bi-Directional Attachment Sync from QuickBooks

**File: `supabase/functions/quickbooks-webhook/index.ts`**

Add a new function to process `Attachable` entity changes and download attachments from QuickBooks:

```typescript
// Fetch attachable (attachment) from QuickBooks
async function fetchQBAttachable(attachableId: string, accessToken: string, realmId: string) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/attachable/${attachableId}`;
  
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

  // Handle Delete operation
  if (operation === "Delete") {
    // We don't delete local attachments when QB attachments are deleted
    // (preserves local records)
    console.log("[Webhook] Attachable deleted in QB, no action taken locally");
    return { success: true, skipped: true, reason: "Delete not synced to local" };
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

  // Check if we already have this attachment (by QB attachable ID or file name)
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

    // Generate storage path
    const fileExt = qbAttachable.FileName?.split('.').pop() || 'bin';
    const storagePath = `vendor_bill/${localBillId}/${Date.now()}-qb-${qbAttachableId}.${fileExt}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('document-attachments')
      .upload(storagePath, fileBytes, {
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
        file_name: qbAttachable.FileName,
        file_path: storagePath,
        file_type: qbAttachable.ContentType || 'application/octet-stream',
        file_size: qbAttachable.Size || fileBytes.length,
        uploaded_by: null, // From QuickBooks
      });

    if (insertError) {
      throw new Error(`Failed to insert attachment record: ${insertError.message}`);
    }

    // Log the sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "bill_attachment",
      entity_id: localBillId,
      action: "webhook_create",
      status: "success",
      details: {
        qb_attachable_id: qbAttachableId,
        qb_bill_id: qbBillId,
        file_name: qbAttachable.FileName,
      },
    });

    console.log(`[Webhook] Created attachment from QB: ${qbAttachable.FileName}`);
    return { success: true, action: "created", billId: localBillId };

  } catch (downloadError: any) {
    console.error("[Webhook] Failed to download/store attachment:", downloadError.message);
    return { success: false, error: downloadError.message };
  }
}
```

Add the handler to the webhook router:

```typescript
// In the entity processing loop
else if (entity.name === "Attachable") {
  const result = await processAttachableUpdate(
    supabase,
    entity.id,
    entity.operation,
    accessToken,
    realmId
  );
  results.push({ entityId: entity.id, entityType: "Attachable", ...result });
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/integrations/supabase/hooks/useVendorBillAttachments.ts` | Add session-based auth forwarding and improve error logging |
| `supabase/functions/quickbooks-webhook/index.ts` | Add `Attachable` entity processing for bi-directional sync |

---

## Implementation Steps

1. **Update `useVendorBillAttachments.ts`**:
   - Get current session before invoking edge function
   - Forward Authorization header explicitly
   - Add comprehensive error handling and logging
   - Handle the response data properly (check both error and data.error)

2. **Update `quickbooks-webhook/index.ts`**:
   - Add `fetchQBAttachable()` helper function
   - Add `processAttachableUpdate()` function to handle incoming attachments
   - Register `Attachable` in the entity processing switch/if block
   - Handle download from QuickBooks TempDownloadUri
   - Upload to Supabase storage with proper path structure
   - Create `vendor_bill_attachments` record
   - Log sync activity

3. **Test the changes**:
   - Upload an attachment to an existing synced vendor bill
   - Verify it appears in QuickBooks
   - Add an attachment to a bill in QuickBooks
   - Verify it syncs back to the app

---

## Technical Notes

### QuickBooks Attachable API
- QuickBooks provides a `TempDownloadUri` in the Attachable response
- This is a temporary signed URL that expires (typically within minutes)
- We need to download immediately when the webhook is received

### Storage Path Convention
- Format: `vendor_bill/{billId}/{timestamp}-qb-{attachableId}.{ext}`
- The `qb-` prefix identifies attachments synced from QuickBooks

### Idempotency
- Check for existing attachments by file name before creating duplicates
- This prevents re-importing the same attachment on webhook retries

