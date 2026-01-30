
# Fix: Vendor Edits Not Syncing to QuickBooks

## Problem Identified

When you edit a vendor in Command X, the changes should sync to QuickBooks but they're not reflecting. After investigation, I found:

### Current State
1. **The sync infrastructure exists** - `quickbooks-sync-vendors` has a `sync-single` action that works correctly (tested and confirmed)
2. **`useUpdateVendor` hook DOES call the sync** - after updating locally, it invokes the edge function
3. **BUT: Errors are swallowed silently** - the catch block only logs to console, no user feedback
4. **No sync status visibility** - unlike Vendor Bills which show QB sync status, Vendors have no visual indicator

### Root Cause
The sync IS being triggered, but if it fails for any reason (e.g., network issues, QB API errors, rate limits), users see "Vendor updated successfully" but never know the QB sync failed.

This differs from Invoices/Estimates/Bills which have:
- Dedicated `quickbooks-update-*` edge functions with proper error handling
- Toast warnings when sync fails
- Sync status badges in the UI

---

## Solution Overview

Create parity with the Invoice/Estimate/Bill sync pattern by:

1. **Create a dedicated `quickbooks-update-vendor` edge function** (consistent with other entities)
2. **Add sync failure feedback** - show toast.warning when QB sync fails
3. **Add sync status to Vendor UI** - show sync status on vendor list/detail pages
4. **Implement race condition prevention** - update mapping timestamp BEFORE sending to QB (like bills)

---

## Technical Implementation

### 1. Create `quickbooks-update-vendor` Edge Function

New file: `supabase/functions/quickbooks-update-vendor/index.ts`

```typescript
// Purpose: Handle vendor updates to QuickBooks with proper error handling
// - Fetches current vendor data from Command X
// - Gets existing QB vendor via mapping
// - Updates QB vendor with SyncToken for conflict prevention
// - Logs to quickbooks_sync_log on success/failure
// - Returns detailed error information for frontend handling
```

Key features:
- Uses existing mapping to find QB vendor ID
- Fetches SyncToken from QB before update (conflict prevention)
- Updates `last_synced_at` BEFORE sending to QB (race condition prevention per project memory)
- Logs sync activity to `quickbooks_sync_log` table
- Returns structured error data for frontend parsing

### 2. Update `useUpdateVendor` Hook

File: `src/integrations/supabase/hooks/useVendors.ts`

Changes:
- Call `quickbooks-update-vendor` instead of `quickbooks-sync-vendors`
- Show `toast.warning()` when sync fails (matching bill behavior)
- Return sync status from mutation

```typescript
// After local update succeeds:
try {
  const qbConnected = await isQuickBooksConnected();
  if (qbConnected) {
    console.log("QuickBooks connected - syncing updated vendor:", id);
    const { data: syncResult, error: syncError } = await supabase.functions.invoke(
      "quickbooks-update-vendor",
      { body: { vendorId: id } }
    );
    
    if (syncError || syncResult?.error) {
      console.error("QuickBooks sync error:", syncError || syncResult?.error);
      // Surface error to user (non-blocking)
      toast.warning("Vendor saved, but QuickBooks sync failed. Check sync status.");
    }
  }
} catch (qbError) {
  console.error("QuickBooks sync error (non-blocking):", qbError);
  toast.warning("Vendor saved, but QuickBooks sync failed.");
}
```

### 3. Add QuickBooks Sync Status Badge to Vendor List

File: `src/pages/Vendors.tsx` (or vendor table component)

Add a QB sync status column showing:
- Green checkmark: Synced
- Yellow warning: Pending/Error
- Gray dash: Not linked to QB

### 4. Update `supabase/config.toml`

Add the new edge function configuration:

```toml
[functions.quickbooks-update-vendor]
verify_jwt = false
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/quickbooks-update-vendor/index.ts` | Create | New dedicated vendor update function |
| `supabase/config.toml` | Update | Add function configuration |
| `src/integrations/supabase/hooks/useVendors.ts` | Update | Call new function, add toast warning |
| `src/pages/Vendors.tsx` | Update | Add QB sync status column |
| `src/components/vendors/VendorEditDialog.tsx` | Update (optional) | Show sync status after save |

---

## Edge Function Logic Flow

```text
1. Receive vendorId
2. Check quickbooks_vendor_mappings for existing QB link
   └─ If no mapping → Return "not synced" (skip update)
3. Fetch current vendor data from Command X
4. Get valid QB access token
5. Fetch current QB vendor to get SyncToken
6. Update mapping.last_synced_at = now() (race condition prevention)
7. Send sparse update to QB vendor endpoint
8. Log to quickbooks_sync_log (success/failure)
9. Return result with sync status
```

---

## Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| Sync trigger | Uses generic `sync-single` action | Dedicated `quickbooks-update-vendor` function |
| Error handling | Silent (console.error only) | Toast warning to user |
| Sync logging | Not logged for single vendor updates | Logged to `quickbooks_sync_log` |
| Race conditions | Not protected | Uses timestamp update before QB call |
| User feedback | "Vendor updated successfully" always | Shows warning if QB sync fails |
| Status visibility | None | Sync status badge in vendor list |

---

## Summary

The vendor sync infrastructure works but lacks proper user feedback and error handling. This fix creates parity with the Invoice/Bill sync pattern by:

1. Creating a dedicated edge function for vendor updates
2. Adding user-facing feedback when sync fails
3. Adding sync status visibility in the UI
4. Implementing race condition prevention

This ensures you'll know immediately if a vendor edit fails to sync to QuickBooks, matching the behavior of other synced entities.
