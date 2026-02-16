

## QuickBooks Bill Sync: Billable Items to Item Details, Expenses to Category Details

### Problem
Currently, `quickbooks-create-bill` sends ALL line items as **Category details** (`AccountBasedExpenseLineDetail`), regardless of whether they are billable or not. The `quickbooks-update-bill` function already has logic to use **Item details** (`ItemBasedExpenseLineDetail`) when a line item has a `qb_product_mapping_id`, but the create function does not.

The desired behavior (matching the QuickBooks screenshot):
- **Billable line items** (those with a QB product mapping) should sync as **Item details** with `BillableStatus: 'Billable'`
- **Non-billable line items** (personnel expenses, general expenses without product mapping) should sync as **Category details** with `BillableStatus: 'NotBillable'`

### Changes

#### 1. Update `quickbooks-create-bill/index.ts`

Port the same `qb_product_mapping_id` lookup logic from `quickbooks-update-bill` into `quickbooks-create-bill`:

- After building the category map (line ~559), add a QB product mapping lookup (same as update-bill lines 460-478)
- In the line item loop (lines 597-620), check if the line has a `qb_product_mapping_id` with a valid QB item:
  - **If yes**: Use `ItemBasedExpenseLineDetail` with `BillableStatus: 'Billable'`, including `ItemRef`, `Qty`, and `UnitPrice`
  - **If no**: Use `AccountBasedExpenseLineDetail` with `BillableStatus: 'NotBillable'` (current behavior)

#### 2. Update `quickbooks-update-bill/index.ts`

The update function already uses `ItemBasedExpenseLineDetail` for mapped items, but sets `BillableStatus: 'NotBillable'` on all lines. Update mapped Item detail lines to use `BillableStatus: 'Billable'` so they appear as billable in QuickBooks (matching the green checkmarks in the screenshot).

### Technical Details

**In `quickbooks-create-bill/index.ts`** (after line 558, before building line items):

```typescript
// Fetch QB product mappings for line items that have them
const qbProductMap = new Map();
if (lineItems && lineItems.length > 0) {
  const qbMappingIds = lineItems
    .map((item: any) => item.qb_product_mapping_id)
    .filter((id: string | null) => id !== null);
  
  if (qbMappingIds.length > 0) {
    const { data: mappings } = await supabase
      .from('qb_product_service_mappings')
      .select('id, name, quickbooks_item_id')
      .in('id', qbMappingIds);
    
    if (mappings) {
      for (const m of mappings) {
        if (m.quickbooks_item_id) {
          qbProductMap.set(m.id, { qb_item_id: m.quickbooks_item_id, name: m.name });
        }
      }
    }
  }
}
```

Then in the line item loop, replace the current always-Category logic with:

```typescript
const qbProduct = item.qb_product_mapping_id 
  ? qbProductMap.get(item.qb_product_mapping_id) 
  : null;

if (qbProduct) {
  // Billable: Use ItemBasedExpenseLineDetail
  qbLineItems.push({
    DetailType: 'ItemBasedExpenseLineDetail',
    Amount: Number(item.total),
    Description: desc,
    ItemBasedExpenseLineDetail: {
      ItemRef: { value: qbProduct.qb_item_id },
      Qty: qty,
      UnitPrice: unitPrice,
      BillableStatus: 'Billable',
    },
  });
} else {
  // Non-billable: Use AccountBasedExpenseLineDetail
  // (existing category-based logic)
}
```

**In `quickbooks-update-bill/index.ts`** (line 505):

Change `BillableStatus: 'NotBillable'` to `BillableStatus: 'Billable'` inside the `ItemBasedExpenseLineDetail` block.

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/quickbooks-create-bill/index.ts` | Add QB product mapping lookup + use Item details for billable lines |
| `supabase/functions/quickbooks-update-bill/index.ts` | Change BillableStatus to 'Billable' for Item detail lines |

