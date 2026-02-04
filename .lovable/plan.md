
# Fix: Bidirectional Delete for Attachments Uploaded from CommandX

## Problem Identified

When you delete an attachment in QuickBooks that was originally **uploaded from CommandX**, the webhook cannot find the corresponding local attachment to delete. This is because:

1. **Wrong lookup key**: The sync log stores `entity_id` = attachment ID (not bill ID), but the current code treats it as a bill ID
2. **Wrong file path pattern**: The code searches for `qb-${attachableId}` in the file path, but only attachments pulled FROM QuickBooks have this prefix. Attachments uploaded FROM CommandX have normal file paths like `vendor-bills/abc123/invoice.pdf`

## Solution

Update the webhook delete logic to:

1. **Parse the `details` JSON** from the sync log to get the actual `bill_id` and `file_name`
2. **Use the attachment ID directly** since `entity_id` in the sync log IS the attachment ID
3. **Fall back to matching by file name** if direct ID lookup works

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/quickbooks-webhook/index.ts` | Fix the delete logic to correctly find and delete local attachments |

## Technical Details

### Current (Broken) Logic
```typescript
// Treats entity_id as bill_id - WRONG for uploaded attachments
.eq("bill_id", syncLog.entity_id)
// Looks for qb- prefix - WRONG for uploaded attachments
.ilike("file_path", `%qb-${qbAttachableId}%`)
```

### Fixed Logic
```typescript
// 1. entity_id IS the attachment ID for uploads, try direct lookup
const { data: directAttachment } = await supabase
  .from("vendor_bill_attachments")
  .select("id, file_path")
  .eq("id", syncLog.entity_id)
  .maybeSingle();

if (directAttachment) {
  // Delete this attachment directly
}

// 2. If not found, parse details to get bill_id and file_name
const details = JSON.parse(syncLog.details);
const { data: matchByName } = await supabase
  .from("vendor_bill_attachments")
  .select("id, file_path")
  .eq("bill_id", details.bill_id)
  .eq("file_name", details.file_name);
```

## Expected Behavior After Fix

1. Upload attachment in CommandX to a vendor bill
2. Attachment syncs to QuickBooks
3. Delete attachment in QuickBooks
4. Webhook fires, finds the local attachment (by direct ID or file name match)
5. Local attachment is deleted from storage and database
6. CommandX UI reflects the deletion
