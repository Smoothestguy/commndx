

## Fix Bulk Edit QuickBooks Sync - Data Mapping Issues

### Problem Summary

When bulk editing vendor bills, the QuickBooks sync produces incorrect data:
1. "labor:contract labor" product entries appear in Item Details (should not exist)
2. A $0 amount category entry is created (should not exist)  
3. qty, rate, and amount values appear in Item Details instead of Category Details

### Root Cause

In `quickbooks-update-bill/index.ts` (lines 498-508), when converting from Item Details to Category Details, the code includes old `ItemBasedExpenseLineDetail` lines with Amount set to `0` to "clear" them. However, QuickBooks does NOT actually delete these lines -- it keeps them as $0 entries with their original product references (e.g., "labor:contract labor"). This is the wrong approach for QuickBooks' Bill update API.

### Solution

**Fix 1: Remove the zeroing-out approach for old Item lines**

Instead of including old ItemBasedExpenseLineDetail lines with Amount=0, we should send ONLY the new AccountBasedExpenseLineDetail lines in the update payload. QuickBooks' sparse update for Bills replaces ALL lines when the `Line` array is provided -- old lines not included in the payload are automatically removed. The zeroing-out approach is unnecessary and creates ghost entries.

Changes in `supabase/functions/quickbooks-update-bill/index.ts`:
- Remove lines 495-515 (the `itemLinesToRemove` logic and the `allLines` merge)
- Set `Line: qbLineItems` directly in the QB bill payload instead of `Line: allLines`

**Fix 2: Filter out zero-amount line items**

Add a safety filter to exclude any line items with a total of 0 from the QB payload, preventing empty category entries from appearing.

Changes in `supabase/functions/quickbooks-update-bill/index.ts`:
- After building `qbLineItems`, filter out any entries where `Amount <= 0`

**Fix 3: Apply the same fix to `quickbooks-create-bill/index.ts`**

Ensure the create function also filters out zero-amount lines for consistency.

### Technical Details

```text
Current flow (broken):
  Local line items --> AccountBasedExpenseLineDetail lines (correct)
  + Old QB ItemBasedExpenseLineDetail lines with Amount=0 (BUG: creates ghost entries)
  = QB sees both Category Details AND Item Details with $0 "labor:contract labor"

Fixed flow:
  Local line items --> AccountBasedExpenseLineDetail lines ONLY
  Filter out Amount <= 0
  = QB replaces all lines cleanly with Category Details only
```

### Files to Change

1. `supabase/functions/quickbooks-update-bill/index.ts`
   - Remove the `itemLinesToRemove` logic (lines 495-515)
   - Use `qbLineItems` directly (filtered for Amount > 0)
   
2. `supabase/functions/quickbooks-create-bill/index.ts`
   - Add zero-amount filter for safety

Both edge functions will be redeployed after changes.

