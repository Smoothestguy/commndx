

## Sequential Bulk Edit with Progress Tracking

### What Changes

Refactor the vendor bill bulk edit to process records one at a time (like manual editing) instead of in a single batch, with a visible progress bar showing real-time status.

### How It Will Work

1. User clicks "Bulk Edit" and applies changes in the modal
2. The modal stays open and shows a progress bar: "Processing 45/158 records..."
3. Each record is updated individually in the database, then synced to QuickBooks if connected
4. If one record fails, it is skipped and processing continues
5. When complete, a summary toast shows successes and failures

### Technical Details

**File 1: `src/components/vendor-bills/VendorBillBulkEditModal.tsx`**

- Add progress state (`current`, `total`, `percent`, `phase`) to track sequential processing
- When processing, replace the form content with a progress view showing:
  - A `Progress` bar component (already exists in the project)
  - Text like "Updating record 45 of 158..." or "Syncing to QuickBooks 12 of 158..."
  - Disable the Cancel/Close button during processing
- Change the `onApply` callback signature to accept a progress setter, or move the sequential logic into the modal itself

**File 2: `src/components/vendor-bills/VendorBillTable.tsx`**

- Refactor `handleBulkEdit` (lines 347-415) to process records sequentially:
  - Instead of `supabase.from("vendor_bills").update(billUpdates).in("id", ids)` (batch), loop through each ID and call `.update(billUpdates).eq("id", id)` individually
  - Same for line item category updates: loop per bill instead of `.in("bill_id", ids)`
  - After each DB update, if QB is connected, immediately sync that bill
  - After each record, call a progress callback and yield to the UI thread with `await new Promise(r => setTimeout(r, 50))`
  - Track successes and failures separately
  - On completion, show summary toast and clear selection

The `handleBulkEdit` function will be restructured to accept a progress callback from the modal:

```text
For each bill (1 to N):
  1. Update vendor_bills row for this bill
  2. Update vendor_bill_line_items category for this bill (if needed)
  3. Sync to QuickBooks (if connected)
  4. Report progress (current/total)
  5. Yield to UI thread (50ms delay)
```

**Files to modify:**
1. `src/components/vendor-bills/VendorBillTable.tsx` - Refactor `handleBulkEdit` to sequential processing with progress callback
2. `src/components/vendor-bills/VendorBillBulkEditModal.tsx` - Add progress bar UI and pass progress state

