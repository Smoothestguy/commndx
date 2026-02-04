

# Fix Vendor Bill Attachment Sync to QuickBooks

## Problem

Attachments uploaded to vendor bills on the Published site are not syncing to QuickBooks because:

1. **The Published site is running OLD code** - The fix we implemented earlier today only exists in the Preview/development environment. The Published site still has code that either never calls the sync function or has the old client-side mapping check that fails.

2. **No sync requests are reaching the edge function** - Edge function logs show only boot/shutdown events, no actual sync attempts. Database has zero `bill_attachment` entries in `quickbooks_sync_log`.

3. **The "success" message you see is for the file upload only** - The Supabase storage upload succeeds, but the QuickBooks sync never triggers.

---

## Solution

### Step 1: Verify and Redeploy Edge Function

Ensure the updated `quickbooks-sync-bill-attachment` function (with server-side mapping resolution) is deployed.

### Step 2: Publish the Updated Frontend Code

The frontend changes in `useVendorBillAttachments.ts` that always attempt the sync must be published to production.

### Step 3: Update Database Schema for Logging

The edge function uses an `operation` column in `quickbooks_sync_log` inserts, but the table schema shows columns are: `id, entity_type, entity_id, quickbooks_id, action, status, error_message, details, created_at`. The function should use `action` instead of `operation`.

**File**: `supabase/functions/quickbooks-sync-bill-attachment/index.ts`

Change from:
```typescript
await supabase.from("quickbooks_sync_log").insert({
  entity_type: "bill_attachment",
  entity_id: attachmentId,
  operation: "upload",  // Wrong column name
  ...
});
```

Change to:
```typescript
await supabase.from("quickbooks_sync_log").insert({
  entity_type: "bill_attachment",
  entity_id: attachmentId,
  action: "upload",  // Correct column name
  ...
});
```

### Step 4: Fix metadata vs details column

Similarly, the function uses `metadata` but the column is named `details`:

Change from:
```typescript
metadata: {
  bill_id: billId,
  qb_bill_id: qbBillId,
  ...
}
```

Change to:
```typescript
details: {
  bill_id: billId,
  qb_bill_id: qbBillId,
  ...
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/quickbooks-sync-bill-attachment/index.ts` | Fix column names: `operation` to `action`, `metadata` to `details` |

---

## After Implementation

After these changes are made and the code is published to production:

1. Upload a new attachment to BILL-2625501
2. Check edge function logs for sync activity
3. Check `quickbooks_sync_log` for `entity_type = 'bill_attachment'` entries
4. Verify the attachment appears in QuickBooks

---

## Technical Details

The current edge function code at lines 307-319:
```typescript
await supabase.from("quickbooks_sync_log").insert({
  entity_type: "bill_attachment",
  entity_id: attachmentId,
  operation: "upload",        // Should be: action
  status: result.success ? "success" : "error",
  error_message: result.error || null,
  metadata: {                 // Should be: details
    bill_id: billId,
    qb_bill_id: qbBillId,
    file_name: attachment.file_name,
    qb_attachable_id: result.attachableId,
  },
});
```

Will be updated to:
```typescript
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
```

