

## Fix: Bill Sync, Deletion, and Item/Category Mapping Issues

### Issues Identified

**Issue 1: Bills created on Command X don't sync correctly to QuickBooks**
The sync itself IS working (sync logs show successful creates). However, the line items are ALL going under **Category Details** (AccountBasedExpenseLineDetail) because `qb_product_mapping_id` is `null` on every single line item in the database. The "billable = Item Details, non-billable = Category Details" logic is correct in the code, but the mapping is never being set. The `qb_product_mapping_id` field on line items is only populated when users manually select a product mapping in the bill form -- but personnel/time-entry bills and most manually created bills never set this field, so everything defaults to Category Details.

**Root Cause**: The system relies on `qb_product_mapping_id` being manually set per line item. There is no automatic detection of whether a bill line item should be "billable" (Item Details) vs "non-billable" (Category Details). For bills created from POs or linked to job orders with products, the product mapping should be auto-populated.

**Issue 2: Deleting a bill from Command X does NOT delete it from QuickBooks**
The `quickbooks-void-bill` function IS being called and the logic looks correct. However, there are no recent logs showing it fired. The likely issue is that the function call is wrapped in a try-catch that swallows errors silently. Since there are no logs at all, the function may not be deploying or the call is failing before reaching the function.

**Issue 3: Deleting bills from QuickBooks changes status to "void" instead of deleting from Command X**
This is by design -- the webhook performs a soft-delete (sets `deleted_at` and `status = 'void'`). But the user expects it to be fully removed from the active bills list. The bill IS soft-deleted (`deleted_at` is set), but if the bills list query doesn't filter out soft-deleted records, they'll still show as "void".

### Fixes

#### Fix 1: Auto-populate `qb_product_mapping_id` for billable line items

When creating bill line items (in `CreateBillFromPODialog.tsx` and `VendorBillForm.tsx`), auto-match line items to QB product mappings:

- In `CreateBillFromPODialog.tsx`: When creating a bill from a PO, look up the PO line item's product and find its corresponding `qb_product_service_mappings` entry. Set `qb_product_mapping_id` on the vendor bill line item.
- In `VendorBillForm.tsx`: When a line item has a `product_id` or is linked to a JO line item that has a product, auto-set the `qb_product_mapping_id`.
- For personnel/time-entry bills (no product mapping): These should remain as Category Details (non-billable), which is the current default behavior -- so no change needed there.

**Key logic**: A line item is "billable" if it has a matching entry in `qb_product_service_mappings`. Personnel expenses and general overhead should NOT have a mapping and will correctly go under Category Details.

#### Fix 2: Ensure `quickbooks-void-bill` is properly called and deployed

- Redeploy the `quickbooks-void-bill` edge function
- Add better error logging in `useDeleteVendorBill` and `useHardDeleteVendorBill` hooks
- Ensure the void function is awaited properly and errors surface in the UI

#### Fix 3: Webhook bill deletion -- keep soft-delete but ensure bills are hidden

The webhook's soft-delete approach is correct for data integrity. Verify the vendor bills query filters out soft-deleted records (`deleted_at IS NULL`). If the "void" status bills are still appearing in the list, add explicit filtering.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/purchase-orders/CreateBillFromPODialog.tsx` | Auto-set `qb_product_mapping_id` from PO line item product mapping |
| `src/integrations/supabase/hooks/useVendorBills.ts` | Improve QB void error handling in delete hooks; verify deleted_at filtering |
| `supabase/functions/quickbooks-void-bill/index.ts` | Add authentication + better logging |
| `supabase/functions/quickbooks-create-bill/index.ts` | No changes needed (Item/Category logic is correct) |
| `supabase/functions/quickbooks-update-bill/index.ts` | No changes needed (Item/Category logic is correct) |

### Technical Details

**Auto-matching product mappings** (Fix 1):
```text
When creating bill from PO:
  1. For each PO line item, get its product_id
  2. Query qb_product_service_mappings WHERE product_id matches
  3. If found, set qb_product_mapping_id on the vendor bill line item
  4. Result: line syncs as ItemBasedExpenseLineDetail (billable)
  5. If not found, leave null -> syncs as AccountBasedExpenseLineDetail (category)
```

**Void bill authentication** (Fix 2):
The `quickbooks-void-bill` function currently has no authentication check (unlike `quickbooks-create-bill` which validates admin/manager role). Add the same auth pattern to ensure the function can be called properly from the client.

