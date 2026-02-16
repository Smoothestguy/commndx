

## Change: Set All Bill Lines to "Not Billable"

### What Changes
Currently, labor bill line items are marked as "Billable" in QuickBooks when a customer mapping is found. You want them to always be "Not Billable" instead.

### Technical Details

**Files to modify:**
- `supabase/functions/quickbooks-create-bill/index.ts`
- `supabase/functions/quickbooks-update-bill/index.ts`

**Changes in both files:**

1. **Remove the customer resolution block** -- The code that looks up the QuickBooks Customer ID (via project -> customer -> customer mapping) is only needed for "Billable" lines. Since all lines will now be "NotBillable", this lookup is no longer necessary.

2. **Hardcode `BillableStatus: 'NotBillable'`** -- On the `ItemBasedExpenseLineDetail` lines (where reg time / OT items are mapped), change from the conditional `qbCustomerRef ? 'Billable' : 'NotBillable'` to simply `'NotBillable'`, and remove the `CustomerRef` field entirely.

### Result
All bill line items synced to QuickBooks will appear under Item Details with the correct product/service (Temp Labor - Reg Time / Temp Labor - OT), but the "Billable" checkbox will NOT be selected.

