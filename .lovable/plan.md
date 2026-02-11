

## Safeguard Historical Data, Rework Category Structure, and Build Sync Mapping Logic

This is a significant architectural change that touches the database schema, the product/category management UI, and the QuickBooks sync pipeline. Here is the breakdown:

---

### Part 1: Safeguard Historical Data

**Problem**: When a product or expense category is deleted/inactivated in either QuickBooks or Command X, historical records (vendor bill line items, invoice line items, PO line items, etc.) that reference those items could lose their context or break.

**Current State**:
- Products use soft-delete (`deleted_at` column) -- good, but 10+ tables have foreign keys to `products` (invoices, estimates, job orders, POs, change orders, TM tickets)
- Expense categories use soft-delete (`is_active = false`) -- good
- The webhook hard-deletes vendor bills when QB deletes them (lines 1620-1671) -- this destroys history
- No protection exists to prevent cascading issues when a referenced product/category is deactivated

**Changes**:

1. **Database**: Add `ON DELETE SET NULL` or `RESTRICT` behavior review -- currently vendor_bill_line_items.category_id references expense_categories. If a category is hard-deleted, line items would break. Verify all FK constraints use safe deletion behavior.

2. **Webhook (quickbooks-webhook/index.ts)**: Change vendor bill "Delete" handling from hard-delete to soft-delete (set `deleted_at` instead of removing rows). This preserves payment history, line items, and attachments.

3. **Product deletion safeguard**: Before allowing product deletion (soft or hard), check if the product is referenced by any historical line items. If so, only allow soft-delete (already the case for `useDeleteProduct`, but `useDeleteProducts` does hard-delete via `.delete()` -- this needs to be changed to soft-delete).

4. **Webhook product/item handling**: When QuickBooks inactivates an item, soft-delete the local product rather than removing it.

---

### Part 2: Rework Product/Category Structure to Mirror QuickBooks

**Problem**: Most products are categorized as "General" (123 products, 124 services). The dropdown needs to mirror QuickBooks Products and Services structure with specific umbrella names like "Temp Labor RT", "Subcontract Labor - Flooring", etc.

**Current State**:
- `product_categories` table has basic entries (General, Roofing, Flooring, Materials, etc.)
- `expense_categories` table has ~50+ detailed accounting categories (Contract Labor, Equipment, etc.)
- Vendor bill line items use `expense_categories` (via `category_id` FK), NOT `product_categories`
- The bill sync maps line items to QB expense accounts via category name matching

**Changes**:

1. **Database**: Add a new `qb_product_mapping_id` column to `vendor_bill_line_items` to optionally link a line item to a QuickBooks product/service for sync purposes, while keeping the expense category for accounting.

2. **New table**: `qb_product_service_mappings` -- stores the QuickBooks Products and Services list as parent umbrella categories:
   - `id` (uuid)
   - `name` (text) -- e.g., "Subcontract Labor Flooring"
   - `quickbooks_item_id` (text) -- the QB Item ID
   - `quickbooks_item_type` (text) -- Service, NonInventory, etc.
   - `is_active` (boolean)
   - Timestamps

3. **UI (VendorBillForm.tsx)**: Add a "QB Product/Service" dropdown on each line item that lets users select the parent QuickBooks umbrella category. This is separate from the expense category (accounting account).

4. **Seed data**: Fetch and cache the QuickBooks Products and Services list into the new mapping table, either on-demand or via a sync button.

---

### Part 3: Build Sync Mapping Logic

**Problem**: When a bill has multiple detailed line items (wall tile, floor tile, mudbed), they should all map to a single parent QuickBooks product/service (e.g., "Subcontract Labor Flooring") while preserving individual descriptions, quantities, and rates.

**Current State**: The `quickbooks-update-bill` edge function maps each line item individually to an expense account via `AccountBasedExpenseLineDetail`. There is no concept of grouping line items under a QB product.

**Changes**:

1. **Update `quickbooks-update-bill/index.ts`**: When a line item has a `qb_product_mapping_id`, use `ItemBasedExpenseLineDetail` instead of `AccountBasedExpenseLineDetail`:
   ```text
   {
     DetailType: "ItemBasedExpenseLineDetail",
     Amount: lineTotal,
     Description: "wall tile - 100 x $2.50",  // preserved detail
     ItemBasedExpenseLineDetail: {
       ItemRef: { value: qbItemId },  // parent QB product
       Qty: quantity,
       UnitPrice: unitCost,
       BillableStatus: "NotBillable"
     }
   }
   ```

2. **Fallback**: Line items without a QB product mapping continue using `AccountBasedExpenseLineDetail` (current behavior), ensuring backward compatibility.

3. **Webhook inbound**: When processing incoming QB bill updates, detect `ItemBasedExpenseLineDetail` lines and try to match them back to the local `qb_product_service_mappings` table.

---

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | Add `qb_product_service_mappings` table; add `qb_product_mapping_id` to `vendor_bill_line_items`; RLS policies |
| `supabase/functions/quickbooks-webhook/index.ts` | Modify | Change bill Delete from hard-delete to soft-delete; handle product inactivation |
| `src/integrations/supabase/hooks/useProducts.ts` | Modify | Change `useDeleteProducts` from hard-delete to soft-delete |
| `src/integrations/supabase/hooks/useQBProductMappings.ts` | Create | Hook to fetch/manage QB product-service mappings |
| `supabase/functions/quickbooks-sync-products/index.ts` | Modify | Add logic to populate `qb_product_service_mappings` when syncing |
| `supabase/functions/quickbooks-update-bill/index.ts` | Modify | Support `ItemBasedExpenseLineDetail` when QB product mapping exists |
| `src/components/vendor-bills/VendorBillForm.tsx` | Modify | Add QB Product/Service dropdown per line item |

---

### Implementation Order

1. Database migration (new table + column + RLS)
2. Safeguard changes (soft-delete fixes in webhook and hooks)
3. QB product mappings hook and sync function updates
4. Bill form UI updates (QB product dropdown)
5. Bill sync logic updates (ItemBasedExpenseLineDetail support)
6. Edge function redeployments

