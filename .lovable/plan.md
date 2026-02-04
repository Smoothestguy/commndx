

# Fix: Delay QuickBooks Attachment Sync Until Bill is Saved

## Problem Found

The QuickBooks attachment sync is triggered **immediately** when you upload a file in Edit mode - it doesn't wait for you to press "Update Bill". This causes sync failures because:

1. You're editing the bill (form has changes)
2. You upload an attachment → file uploads successfully
3. The code **immediately** calls `syncAttachmentToQuickBooks()` in a `.then()` callback
4. But the bill hasn't been saved yet, so QuickBooks may have stale data or the sync fails

The "save-first" dialog we implemented only catches the case when `isFormDirty` is true. But the real issue is that **any attachment upload in edit mode should NOT sync to QuickBooks until the bill is saved**.

## Root Cause (Code Location)

In `src/integrations/supabase/hooks/useVendorBillAttachments.ts`, lines 108-136:

```typescript
// This runs IMMEDIATELY after file upload
syncAttachmentToQuickBooks(data.id, billId).then((result) => {
  // Shows success/failure toasts
});
```

## Solution

Change the attachment sync to be **deferred** until after the bill is saved, not immediate:

### Option A: Remove Auto-Sync, Require Manual Sync (Simplest)
- Remove the automatic `syncAttachmentToQuickBooks()` call after upload
- User must click "Retry Sync" after saving the bill
- **Pro**: Simple, prevents all timing issues
- **Con**: Extra manual step for users

### Option B: Sync After Bill Save (Recommended)
- Upload the attachment but **don't** sync to QuickBooks immediately
- Store "pending sync" state on the attachment
- When the bill is saved (Update Bill button), sync all pending attachments as part of the save flow
- **Pro**: Seamless UX - user uploads, presses save, everything syncs
- **Con**: More complex implementation

### Option C: Only Allow Uploads After Bill is Unchanged (Strictest)
- Block uploads entirely unless the form has no unsaved changes AND the bill is synced to QB
- **Pro**: Prevents all sync timing issues
- **Con**: May frustrate users who want to add attachments while editing

## Recommended Implementation: Option B (Hybrid)

1. **Remove auto-sync from upload hook**: In `useUploadVendorBillAttachment`, don't call `syncAttachmentToQuickBooks()` automatically

2. **Add sync step to bill save flow**: When `handleSubmit` in `VendorBillForm` successfully saves the bill:
   - Query for any attachments without a QuickBooks sync
   - Sync them one-by-one (or in parallel)
   - Show combined success/failure toasts

3. **Keep "Retry Sync" button**: For any attachments that fail, user can manually retry

## Files to Modify

| File | Change |
|------|--------|
| `src/integrations/supabase/hooks/useVendorBillAttachments.ts` | Remove auto-sync in `useUploadVendorBillAttachment`, add `useSyncPendingAttachments` hook |
| `src/components/vendor-bills/VendorBillForm.tsx` | After bill save succeeds, call sync for pending attachments |
| `src/components/vendor-bills/VendorBillAttachments.tsx` | Update messaging to indicate "will sync when bill is saved" |

## Expected Behavior After Fix

1. **Edit bill** → make changes
2. **Upload attachment** → file uploads, toast shows "Attachment added (will sync to QB when you save)"
3. **Press "Update Bill"** → bill saves, then attachments sync to QuickBooks
4. **Toast shows** → "Bill updated and attachments synced to QuickBooks"

If you upload an attachment and then cancel without saving, the attachment stays local but isn't synced to QB (can be synced later via Retry button).

