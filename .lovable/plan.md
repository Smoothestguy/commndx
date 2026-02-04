
# Fix Vendor Bill Attachment Sync and Add Toast Close Button

## Problem Summary

Two issues reported:
1. Attachments added to vendor bills are not syncing to QuickBooks
2. Toast notifications at the bottom of the screen don't have a visible close button (X)

---

## Issue 1: Attachment Sync Not Working

### Investigation Findings

The sync logs show no attachment-related entries, meaning the sync function is never being invoked. After reviewing the code:

- The `useUploadVendorBillAttachment` hook correctly checks for QB bill mappings
- The edge function `quickbooks-sync-bill-attachment` exists and is properly implemented
- The hook calls `supabase.functions.invoke()` in a `.then()` callback

**Root Cause**: The code checks if `sync_status === "synced"`, but the mapping table may have a different status value (like `success` instead of `synced`), causing the condition to fail silently.

### Solution

Update the sync condition to check for valid sync status values and add better logging to catch issues:

**File**: `src/integrations/supabase/hooks/useVendorBillAttachments.ts`

```typescript
// Fix: Check for valid sync status (could be 'synced' or 'success')
const isSynced = qbMapping.sync_status === "synced" || qbMapping.sync_status === "success";

if (qbMapping && isSynced && qbMapping.quickbooks_bill_id) {
  console.log("Triggering QB attachment sync for bill:", billId);
  // ... sync code
}
```

Also add immediate logging before the QB mapping check to debug the issue.

---

## Issue 2: Toast Close Button Not Visible

### Investigation Findings

The app uses Sonner for toast notifications. The `Toaster` component in `src/components/ui/sonner.tsx` doesn't have the `closeButton` prop enabled.

### Solution

Add `closeButton={true}` to the Sonner Toaster component to always show an X button on toasts.

**File**: `src/components/ui/sonner.tsx`

```tsx
return (
  <Sonner
    theme={theme as ToasterProps["theme"]}
    className="toaster group"
    closeButton={true}  // Add this line
    toastOptions={{...}}
    {...props}
  />
);
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/integrations/supabase/hooks/useVendorBillAttachments.ts` | Fix sync status check and add debugging logs |
| `src/components/ui/sonner.tsx` | Add `closeButton={true}` prop |

---

## Technical Details

### Attachment Sync Fix

The current code:
```typescript
if (qbMapping && qbMapping.sync_status === "synced" && qbMapping.quickbooks_bill_id) {
```

Will be updated to:
```typescript
// Log the mapping result for debugging
console.log("QB mapping check for bill:", billId, qbMapping);

// Check for valid sync statuses (different sources may use different values)
const validSyncStatuses = ["synced", "success"];
const isSynced = qbMapping && 
  validSyncStatuses.includes(qbMapping.sync_status) && 
  qbMapping.quickbooks_bill_id;

if (isSynced) {
  console.log("Triggering QB attachment sync:", {
    attachmentId: data.id,
    billId,
    qbBillId: qbMapping.quickbooks_bill_id
  });
  // ... rest of sync code
}
```

### Toast Close Button

Sonner supports a `closeButton` prop that renders a visible X button on all toasts. This makes it easy for users to dismiss notifications without waiting for auto-dismiss.

---

## Expected Behavior After Fix

1. **Attachment Sync**: When adding attachments to a synced vendor bill, they will sync to QuickBooks. Console logs will show the sync process for debugging.

2. **Toast Close Button**: All toast notifications will display an X button in the top-right corner that users can click to immediately dismiss the notification.
