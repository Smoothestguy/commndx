
# Plan: Sync Vendor Bill Attachments to QuickBooks on Upload

## Problem

When adding attachments to an existing vendor bill that's already synced to QuickBooks, the attachments are only saved locally—they don't sync to QuickBooks.

**Current Behavior:**
- New bills: Attachments sync during creation via `quickbooks-create-bill`
- Existing bills: Attachments save locally only—no QuickBooks sync

## Solution

Add QuickBooks attachment sync logic to the `useUploadVendorBillAttachment` hook so that when an attachment is uploaded to an existing synced bill, it automatically uploads to QuickBooks.

---

## Implementation

### 1. Update `useUploadVendorBillAttachment` Hook

**File:** `src/integrations/supabase/hooks/useVendorBillAttachments.ts`

Add QuickBooks sync after successful database insert:

```typescript
// After inserting attachment record, sync to QuickBooks if bill is synced
const { data: qbMapping } = await supabase
  .from("quickbooks_bill_mappings")
  .select("quickbooks_bill_id, sync_status")
  .eq("bill_id", billId)
  .maybeSingle();

if (qbMapping && qbMapping.sync_status === "synced") {
  // Trigger attachment sync to QuickBooks
  await supabase.functions.invoke("quickbooks-sync-bill-attachment", {
    body: { 
      attachmentId: data.id,
      billId: billId,
      qbBillId: qbMapping.quickbooks_bill_id
    },
  });
}
```

### 2. Create New Edge Function for Attachment Sync

**File:** `supabase/functions/quickbooks-sync-bill-attachment/index.ts`

This function will:
1. Receive the attachment ID and QuickBooks bill ID
2. Fetch the attachment record from the database
3. Download the file from Supabase storage
4. Upload it to QuickBooks and link it to the bill
5. Log the sync result

The attachment upload logic will reuse the same `uploadAttachmentToQB` pattern from `quickbooks-create-bill`.

### 3. Add Attachment Sync to Bill Update (Optional Enhancement)

**File:** `supabase/functions/quickbooks-update-bill/index.ts`

Add logic similar to `quickbooks-create-bill` to sync any new attachments that haven't been synced yet. This would catch attachments added between operations.

---

## Technical Details

### Edge Function: `quickbooks-sync-bill-attachment`

```text
Input:
- attachmentId: string (attachment record ID)
- billId: string (local vendor bill ID)  
- qbBillId: string (QuickBooks bill ID)

Process:
1. Authenticate request (admin/manager only)
2. Get QuickBooks token
3. Fetch attachment record from database
4. Download file from Supabase storage
5. Build multipart form data
6. Upload to QuickBooks /upload endpoint
7. Log result to quickbooks_sync_log

Output:
- success: boolean
- attachableId: string (QuickBooks attachment ID)
```

### Hook Changes

The `useUploadVendorBillAttachment` mutation will be enhanced to:
1. Insert attachment record (existing)
2. Check if bill has QuickBooks mapping
3. If synced, invoke `quickbooks-sync-bill-attachment` (non-blocking)
4. Show toast for sync status

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/quickbooks-sync-bill-attachment/index.ts` | **Create** | New edge function to sync individual attachments |
| `src/integrations/supabase/hooks/useVendorBillAttachments.ts` | **Modify** | Add QB sync trigger after upload |

---

## User Experience

After this fix:

1. User opens existing vendor bill synced to QuickBooks
2. User adds attachment
3. Attachment uploads to local storage ✓
4. Attachment record created in database ✓
5. **NEW:** Attachment automatically syncs to QuickBooks ✓
6. Toast notification confirms "Attachment synced to QuickBooks"

---

## Edge Cases Handled

- **Bill not synced to QB:** Skip sync, attachment saved locally only
- **QB connection lost:** Attachment saved locally, sync fails gracefully with warning
- **File download error:** Report error, don't crash
- **QB upload quota/limits:** Log error, continue

---

## Security

- Edge function validates admin/manager role before processing
- Uses existing QuickBooks token refresh logic
- Non-blocking: attachment save succeeds even if QB sync fails
