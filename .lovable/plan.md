

## Fix: QuickBooks Not Removing Old Item Details Lines

### Problem
The previous fix removed the zeroing-out logic, assuming QuickBooks would automatically remove old `ItemBasedExpenseLineDetail` lines when a new `Line` array is provided. However, the update endpoint (`POST /bill`) uses **sparse update** by default, which **merges** lines rather than replacing them. This means old Item Detail lines persist even when only Category Detail lines are sent.

### Root Cause
The `qbBill` payload sent to QuickBooks does not include `"sparse": false`. Without this flag, QuickBooks performs a sparse (partial) update and keeps any existing lines not present in the new payload.

### Solution
Add `"sparse": false` to the bill update payload in `quickbooks-update-bill/index.ts`. This tells QuickBooks to perform a **full update**, replacing all existing lines with only the ones provided -- effectively removing any old Item Detail lines.

### File to Change

**`supabase/functions/quickbooks-update-bill/index.ts`** (line ~501)

Add `sparse: false` to the `qbBill` object:

```text
Before:
  const qbBill = {
    Id: qbBillId,
    SyncToken: syncToken,
    VendorRef: ...,
    Line: filteredLineItems,
    ...
  };

After:
  const qbBill = {
    sparse: false,       // <-- Force full update to remove old Item Detail lines
    Id: qbBillId,
    SyncToken: syncToken,
    VendorRef: ...,
    Line: filteredLineItems,
    ...
  };
```

This single change ensures that when the bill is updated, QuickBooks completely replaces the line items, removing any leftover "labor:contract labor" Item Detail entries.

The edge function will be redeployed after the change.
