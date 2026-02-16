

## Fix: "Select a customer for each billable split line" Error

### Root Cause

QuickBooks requires a `CustomerRef` on every line item that has `BillableStatus: "Billable"`. The current code sets `BillableStatus: "Billable"` but never includes a `CustomerRef`, causing the validation error.

### Data Path (Already Available)

The data chain to resolve the customer exists:
1. `vendor_bill_line_items` has a `project_id` column
2. `projects` has a `customer_id` column
3. `quickbooks_customer_mappings` maps `customer_id` to `quickbooks_customer_id`

For the failing bill (BILL-2625552), the line items point to project "EM-228 DOODIE CALLS", which belongs to customer `da445690...`, which is mapped to QuickBooks Customer ID `70`.

### Fix

In both edge functions, BEFORE building the line items, resolve the QuickBooks Customer ID from the line items' project:

1. Get all unique `project_id` values from line items
2. Look up those projects to get `customer_id`
3. Look up `quickbooks_customer_mappings` to get `quickbooks_customer_id`
4. Add `CustomerRef: { value: qbCustomerId }` to every `ItemBasedExpenseLineDetail` that has `BillableStatus: "Billable"`

### Technical Changes

**Both `quickbooks-create-bill/index.ts` and `quickbooks-update-bill/index.ts`:**

Add customer resolution (before line item building):

```typescript
// Resolve QB Customer for billable lines
let qbCustomerRef = null;
if (isBillable && lineItems?.length > 0) {
  const projectIds = [...new Set(lineItems.map((i: any) => i.project_id).filter(Boolean))];
  if (projectIds.length > 0) {
    const { data: project } = await supabase
      .from('projects')
      .select('customer_id')
      .eq('id', projectIds[0])
      .single();
    if (project?.customer_id) {
      const { data: custMapping } = await supabase
        .from('quickbooks_customer_mappings')
        .select('quickbooks_customer_id')
        .eq('customer_id', project.customer_id)
        .single();
      if (custMapping?.quickbooks_customer_id) {
        qbCustomerRef = { value: custMapping.quickbooks_customer_id };
      }
    }
  }
}
```

Then in the billable line item section, add `CustomerRef`:

```typescript
ItemBasedExpenseLineDetail: {
  ItemRef: { value: itemId },
  Qty: qty,
  UnitPrice: unitPrice,
  BillableStatus: 'Billable',
  CustomerRef: qbCustomerRef,  // <-- ADD THIS
},
```

If no customer mapping is found, fall back to `BillableStatus: 'NotBillable'` to avoid the same error.

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/quickbooks-create-bill/index.ts` | Add customer resolution + `CustomerRef` on billable lines |
| `supabase/functions/quickbooks-update-bill/index.ts` | Same changes for consistency |

