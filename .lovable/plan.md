

# Switch Vendor Bill Sync to Category Details (AccountBasedExpenseLineDetail)

## Problem

When vendor bills sync to QuickBooks, line items currently appear under **Item details** using `ItemBasedExpenseLineDetail`. You want them to appear under **Category details** instead, with the description combining the item description, quantity, and rate into a single text field (e.g., "doodie calls reg hrs 12 x $19 and overtime hrs 20 x $28.50").

## What Changes

The QuickBooks Bill API supports two line detail types:
- **ItemBasedExpenseLineDetail** (current) -- requires a Product/Service item reference, shows in "Item details" section
- **AccountBasedExpenseLineDetail** (desired) -- uses an expense account directly, shows in "Category details" section

Switching to `AccountBasedExpenseLineDetail` is actually **simpler** because it removes the need to create/manage Service Items in QuickBooks entirely.

## Implementation

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/quickbooks-create-bill/index.ts` | Switch line items from `ItemBasedExpenseLineDetail` to `AccountBasedExpenseLineDetail` |
| `supabase/functions/quickbooks-update-bill/index.ts` | Same change for bill updates |

### Line Item Format Change

**Current (Item details):**
```json
{
  "DetailType": "ItemBasedExpenseLineDetail",
  "Amount": 798.00,
  "Description": "doodie calls",
  "ItemBasedExpenseLineDetail": {
    "ItemRef": { "value": "123" },
    "Qty": 12,
    "UnitPrice": 19.00,
    "BillableStatus": "NotBillable"
  }
}
```

**New (Category details):**
```json
{
  "DetailType": "AccountBasedExpenseLineDetail",
  "Amount": 798.00,
  "Description": "doodie calls reg hrs 12 x $19.00",
  "AccountBasedExpenseLineDetail": {
    "AccountRef": { "value": "456", "name": "Contract labor" },
    "BillableStatus": "NotBillable"
  }
}
```

### Description Format

The description will combine the original description with quantity and rate:
- Format: `{description} - {quantity} x ${rate}`
- Example: `"Concrete work - 5 x $150.00"` with Amount = $750.00

### Code Cleanup

Since `AccountBasedExpenseLineDetail` uses an Account reference directly (which we already resolve via `getExpenseAccountRef`), the `getOrCreateQBServiceItem` function and related item cache logic can be **removed entirely** from both files. This simplifies the sync significantly.

### Changes in Detail

**In both edge functions, the line item building loop changes from:**
```typescript
const qbItemId = await getOrCreateQBServiceItem(...);
qbLineItems.push({
  DetailType: 'ItemBasedExpenseLineDetail',
  Amount: Number(item.total),
  Description: item.description,
  ItemBasedExpenseLineDetail: {
    ItemRef: { value: qbItemId },
    Qty: qty,
    UnitPrice: unitPrice,
    BillableStatus: 'NotBillable',
  },
});
```

**To:**
```typescript
const desc = `${item.description} - ${qty} x $${unitPrice.toFixed(2)}`;
qbLineItems.push({
  DetailType: 'AccountBasedExpenseLineDetail',
  Amount: Number(item.total),
  Description: desc,
  AccountBasedExpenseLineDetail: {
    AccountRef: expenseAccountRef,
    BillableStatus: 'NotBillable',
  },
});
```

## Result

After this change, synced vendor bills in QuickBooks will show line items under **Category details** with:
- **Category** column mapped to the expense account (e.g., "Contract labor")
- **Description** column containing the combined description with qty and rate
- **Amount** column with the total

The "Item details" section will remain empty, matching the reference screenshot.
