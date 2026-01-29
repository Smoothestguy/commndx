

# Add Better Error Handling for QuickBooks Vendor Sync Failures

## Problem Statement
When a vendor bill fails to sync to QuickBooks due to a vendor issue (e.g., the vendor was deleted in QuickBooks), the current error message is a raw API error that doesn't help users understand or resolve the problem:

**Current error:** `"QuickBooks API error: 400 - Invalid Reference Id : Vendor assigned to this transaction has been deleted..."`

Users need:
1. A clear explanation of what went wrong
2. Which vendor is causing the issue
3. Actionable steps to fix it

## Solution Overview
Create a comprehensive error handling system that:
1. Parses QuickBooks API errors to extract vendor-specific issues
2. Shows a user-friendly dialog with the error details and recovery options
3. Provides one-click actions to re-sync the vendor or navigate to the vendor profile
4. Stores detailed error information in the mapping table for debugging

## Implementation Details

### 1. Create VendorBillSyncErrorDialog Component
**File:** `src/components/vendor-bills/VendorBillSyncErrorDialog.tsx`

A new dialog component that displays when a vendor bill sync fails:

| Element | Description |
|---------|-------------|
| Error Type Badge | Shows error category (e.g., "Vendor Issue", "Connection Error") |
| Vendor Name | Highlights which vendor is causing the problem |
| Error Description | User-friendly explanation of what went wrong |
| Recovery Actions | Buttons for "Re-sync Vendor", "Edit Vendor", "Retry Sync" |

**Error Categories to Handle:**
- **Vendor Deleted:** Vendor was deleted in QuickBooks
- **Vendor Not Found:** Vendor mapping is invalid
- **Token Expired:** QuickBooks connection needs refresh
- **Rate Limited:** Too many requests
- **Generic Error:** Fallback for unknown errors

### 2. Create Error Parser Utility
**File:** `src/lib/quickbooksErrorParser.ts`

Utility functions to parse QuickBooks API errors and extract actionable information:

```typescript
interface ParsedQBError {
  type: 'vendor_deleted' | 'vendor_not_found' | 'auth_error' | 'rate_limit' | 'unknown';
  title: string;
  description: string;
  vendorName?: string;
  vendorId?: string;
  actionable: boolean;
  suggestedAction?: 'resync_vendor' | 'reconnect' | 'retry';
}
```

**Error Pattern Matching:**
- `"Invalid Reference Id"` + `"deleted"` → Vendor deleted in QuickBooks
- `"Vendor not found"` → Vendor mapping broken
- `"AuthenticationFailed"` or 401 → Token expired
- `"RateLimitExceeded"` → Too many requests

### 3. Update useQuickBooks Hook
**File:** `src/integrations/supabase/hooks/useQuickBooks.ts`

Enhance `useSyncVendorBillToQB` to:
1. Parse the error response and extract structured data
2. Return the error along with vendor context from the bill
3. Provide a method to resync the vendor before retrying

### 4. Update VendorBillForm Component
**File:** `src/components/vendor-bills/VendorBillForm.tsx`

Modify the sync error handling to:
1. Show the new `VendorBillSyncErrorDialog` instead of a simple toast
2. Pass vendor information to the dialog for context
3. Allow retry after vendor is re-synced

### 5. Update VendorBillTable and VendorBillCard
**Files:** 
- `src/components/vendor-bills/VendorBillTable.tsx`
- `src/components/vendor-bills/VendorBillCard.tsx`

Add:
1. Show error message on hover over the "Error" badge
2. Show the sync error dialog when clicking "Retry QuickBooks Sync"
3. Display the specific error from `billMapping.error_message`

### 6. Update Edge Function Error Response
**File:** `supabase/functions/quickbooks-create-bill/index.ts`

Enhance error responses to include:
1. Error code/type for easier parsing
2. Vendor name and ID when applicable
3. Suggested recovery action

## File Changes Summary

| File | Action |
|------|--------|
| `src/components/vendor-bills/VendorBillSyncErrorDialog.tsx` | Create new dialog component |
| `src/lib/quickbooksErrorParser.ts` | Create new error parser utility |
| `src/integrations/supabase/hooks/useQuickBooks.ts` | Update to return structured errors |
| `src/components/vendor-bills/VendorBillForm.tsx` | Add error dialog integration |
| `src/components/vendor-bills/VendorBillTable.tsx` | Show error details on hover/click |
| `src/components/vendor-bills/VendorBillCard.tsx` | Show error details on hover/click |
| `supabase/functions/quickbooks-create-bill/index.ts` | Enhance error response structure |

## UI/UX Design

**Error Dialog Layout:**
```text
┌────────────────────────────────────────────────────┐
│  ⚠️ QuickBooks Sync Failed                        │
├────────────────────────────────────────────────────┤
│                                                    │
│  [Vendor Issue] badge                              │
│                                                    │
│  The vendor "Enyerbe Figueredo" has been deleted  │
│  in QuickBooks. This bill cannot sync until the   │
│  vendor is restored or re-synced.                 │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ Technical Details (collapsed by default)     │ │
│  │ Error code: 2500                             │ │
│  │ Invalid Reference Id: Vendor deleted...       │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  Suggested Actions:                                │
│  ┌─────────────────┐  ┌──────────────────────┐   │
│  │ Re-sync Vendor  │  │ View Vendor Profile  │   │
│  └─────────────────┘  └──────────────────────┘   │
│                                                    │
│              [Cancel]  [Retry Sync]               │
└────────────────────────────────────────────────────┘
```

**Error Badge Tooltip:**
When hovering over the "Sync Error" badge, show the error message in a tooltip.

## Error Messages

| Error Type | User-Friendly Message |
|------------|----------------------|
| Vendor Deleted | "The vendor '{name}' has been deleted in QuickBooks. Re-sync the vendor to create it again, or restore it in QuickBooks." |
| Vendor Not Found | "The vendor '{name}' could not be found in QuickBooks. Try re-syncing the vendor." |
| Auth Error | "The QuickBooks connection has expired. Please reconnect to QuickBooks in settings." |
| Rate Limit | "QuickBooks is temporarily limiting requests. Please wait a few minutes and try again." |
| Unknown | "An unexpected error occurred while syncing to QuickBooks. Please try again." |

## Recovery Actions

1. **Re-sync Vendor:** Calls `useSyncSingleVendor` to create/update the vendor in QuickBooks, then retries the bill sync
2. **View Vendor Profile:** Navigates to `/vendors/{id}` for manual inspection
3. **Retry Sync:** Simply retries the bill sync (useful after manual fixes)
4. **Go to Settings:** Links to `/settings/quickbooks` for reconnection issues

## Technical Notes

- Uses existing `useSyncSingleVendor` hook for vendor re-sync
- Error message is already stored in `quickbooks_bill_mappings.error_message`
- The `billMapping` query already returns `error_message` field
- Follows existing dialog patterns from `ProductConflictDialog.tsx`
- Uses `Collapsible` component for technical details section

