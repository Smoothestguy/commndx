

## Fix: Bills Syncing to Category Details Instead of Item Details

### Root Cause

The system has a chain of missing data that prevents Item Details from being used:

1. **`qb_product_service_mappings`** entries exist locally but have `quickbooks_item_id = NULL` -- they were never synced to QuickBooks to get actual QB Item IDs
2. **Most products** don't have `qb_product_mapping_id` set, so even the lookup chain from the `CreateBillFromPODialog` finds nothing
3. **The edge function** correctly checks `qb_product_mapping_id` -> `quickbooks_item_id`, but since both are null, every line falls back to `AccountBasedExpenseLineDetail` (Category Details)

The current approach of relying on pre-existing mappings is fragile. The fix should make the edge functions smart enough to auto-resolve QB Items at sync time.

### Solution

Modify both `quickbooks-create-bill` and `quickbooks-update-bill` edge functions to:

1. **Detect billable bills**: If a bill has a `purchase_order_id`, treat ALL its line items as billable (Item Details)
2. **Auto-find or create QB Items**: For billable line items without a valid `quickbooks_item_id`, search QuickBooks for a matching Service item (e.g., "Labor:Temp Labor - Reg Time"). If not found, create one
3. **Cache resolved items**: Store the resolved `quickbooks_item_id` back to `qb_product_service_mappings` for future syncs
4. **Non-PO bills stay as Category Details**: Personnel payments, fuel, general expenses (bills without a `purchase_order_id`) continue using `AccountBasedExpenseLineDetail`

### Technical Details

#### Edge Function Changes (both create and update)

In the line item building section, add logic BEFORE the existing `qbProduct` check:

```text
For each line item:
  1. If bill has purchase_order_id (billable):
     a. Try existing qb_product_mapping_id -> quickbooks_item_id path
     b. If no mapping or no QB item ID:
        - Look up the PO line item's product via po_line_item_id
        - Check if product has a qb_product_mapping with quickbooks_item_id
        - If still no QB item: search QB for a default "Subcontract Labor" item
        - If none exists: create a "Subcontract Labor" Service item in QB
        - Use the resolved QB item ID for ItemBasedExpenseLineDetail
  2. If bill has NO purchase_order_id (expense):
     - Use AccountBasedExpenseLineDetail (current behavior)
```

The key insight from the user's screenshots: the "Item details" section shows "Labor:Temp Labor - Reg Time" and "Labor:Temp Labor - OT" as the PRODUCT/SERVICE. These are existing QuickBooks items. The edge function needs to find these items by name or use a configurable default.

#### Default Item Resolution Strategy

1. Query `qb_product_service_mappings` for any mapping with a valid `quickbooks_item_id`
2. If found, use it as the default billable item
3. If not found, search QuickBooks for items named like "Labor" or "Subcontract"
4. If still not found, create a "Subcontract Labor" Service item
5. Cache the result for all subsequent line items in the same bill

#### VendorBillLineItem Interface Update

Add missing fields to the TypeScript interface so they flow through properly:

```typescript
export interface VendorBillLineItem {
  // ...existing fields...
  qb_product_mapping_id?: string | null;
  jo_line_item_id?: string | null;
}
```

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/quickbooks-create-bill/index.ts` | Add auto-resolve QB Item logic for PO-linked bills |
| `supabase/functions/quickbooks-update-bill/index.ts` | Same auto-resolve logic for consistency |
| `src/integrations/supabase/hooks/useVendorBills.ts` | Add `qb_product_mapping_id` and `jo_line_item_id` to `VendorBillLineItem` interface |

### Decision Logic Summary

```text
Is bill linked to a Purchase Order?
  YES -> ALL line items use ItemBasedExpenseLineDetail (Item Details)
         Auto-resolve QB Item ID from mappings or create one
  NO  -> ALL line items use AccountBasedExpenseLineDetail (Category Details)
         Use expense category for account mapping
```

This matches the user's requirement: "billable bills go under Item Details, personal/expense bills go under Category Details."

