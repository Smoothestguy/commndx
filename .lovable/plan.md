# Fix: Vendor Edits Not Syncing to QuickBooks

## ✅ COMPLETED

All planned changes have been implemented:

### 1. Created `quickbooks-update-vendor` Edge Function ✅
- File: `supabase/functions/quickbooks-update-vendor/index.ts`
- Fetches vendor data and existing QB mapping
- Gets SyncToken from QB for conflict prevention
- Updates `last_synced_at` BEFORE sending to QB (race condition prevention)
- Logs sync activity to `quickbooks_sync_log` table
- Returns structured error data for frontend handling

### 2. Updated `useUpdateVendor` Hook ✅
- File: `src/integrations/supabase/hooks/useVendors.ts`
- Now calls dedicated `quickbooks-update-vendor` function
- Shows `toast.warning()` when sync fails (matching bill behavior)

### 3. Added QB Sync Status to Vendor List ✅
- File: `src/pages/Vendors.tsx`
- Added `QB Status` column showing sync status badge
- Uses existing `QuickBooksSyncBadge` component
- Column only appears when QuickBooks is connected

### 4. Updated `supabase/config.toml` ✅
- Added function configuration for `quickbooks-update-vendor`

## Summary
Vendor sync now has parity with Invoice/Bill sync pattern:
- Dedicated edge function with proper error handling
- User-facing feedback when sync fails
- Sync status visibility in the UI
- Race condition prevention
- Sync logging to quickbooks_sync_log
