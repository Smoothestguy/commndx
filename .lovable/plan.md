

## Restructure Products "Add New Item" Dialog Around QB Umbrella Categories

### What Changes

The "Add New Item" dialog on the Products & Services page will be reworked so you **first pick a QB umbrella category** (e.g., "Subcontract Labor Flooring", "Temp Labor RT", "Temp Labor OT") instead of picking Product/Service/Labor. The selected umbrella determines the context for the new item, and every product created gets linked to its parent QB category.

### How It Will Work

1. Open "Add New Item" -- first thing you see is a searchable list/dropdown of QB umbrella categories (from `qb_product_service_mappings`)
2. Select an umbrella (e.g., "Subcontract Labor - Flooring")
3. The rest of the form appears: Name, Description, Cost, Margin, Unit, Taxable -- same fields as today, minus the old Item Type selector and the old Category dropdown (those are replaced by the umbrella)
4. On save, the product is created and linked to the selected QB umbrella via a new `qb_product_mapping_id` column on the `products` table
5. If no QB umbrellas exist yet, a "Create New" option lets you add one inline (with optional QB sync)
6. The Item Type (Product/Service/Labor) is kept as a secondary field or auto-derived based on the umbrella's `quickbooks_item_type`

### Database Changes

**Migration**: Add `qb_product_mapping_id` column to `products` table

```text
ALTER TABLE public.products
  ADD COLUMN qb_product_mapping_id uuid REFERENCES public.qb_product_service_mappings(id) ON DELETE SET NULL;
```

This links each product to its parent QB umbrella category. Existing products with category "General" will have this as NULL initially.

### UI Changes

**File: `src/pages/Products.tsx`**

1. Replace the 3-button Item Type selector (Product/Service/Labor) with a QB Umbrella Category selector as the **first step** in the dialog
   - Searchable dropdown showing all active entries from `qb_product_service_mappings`
   - Option to "+ Create new umbrella" inline (name + type)
2. Keep Item Type as a smaller secondary toggle (since QB items have a type -- Service, NonInventory -- this can be auto-filled from the umbrella's `quickbooks_item_type`)
3. Remove the old "Category" dropdown (the umbrella IS the category now)
4. The product's `category` field (string) gets auto-populated from the umbrella name for backward compatibility with existing code that reads `product.category`
5. Add `qb_product_mapping_id` to the form data and pass it on save

**File: `src/integrations/supabase/hooks/useProducts.ts`**

- Update `useAddProduct` and `useUpdateProduct` to include `qb_product_mapping_id` in the insert/update payload

**File: `src/integrations/supabase/hooks/useQBProductMappings.ts`**

- Add `useCreateQBProductMapping` mutation for inline creation of new umbrellas
- Add `useDeleteQBProductMapping` for soft-delete (set `is_active = false`)

**File: New `src/components/products/CreateQBUmbrellaDialog.tsx`**

- Small inline dialog/section within the Add Item form for creating a new QB umbrella on the fly
- Fields: Name, Type (Service / Non-Inventory Product)
- On create: inserts into `qb_product_service_mappings`, and if QB is connected, syncs to QuickBooks via the edge function

**File: `supabase/functions/quickbooks-sync-products/index.ts`**

- Add a `create-qb-product-mapping` action that creates the Item in QuickBooks and returns the QB Item ID

### Data Flow

```text
User picks umbrella "Subcontract Labor - Flooring"
  -> Form auto-fills: Item Type = "Service", Category = "Subcontract Labor - Flooring"
  -> User enters: Name = "Floor Tile Installation", Cost = $45, Margin = 30%
  -> On save:
     -> products row created with qb_product_mapping_id = [umbrella ID], category = "Subcontract Labor - Flooring"
     -> When this product is used on a vendor bill, the umbrella's QB Item ID is used for ItemBasedExpenseLineDetail sync
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | Add `qb_product_mapping_id` to `products` table |
| `src/pages/Products.tsx` | Modify | Restructure Add/Edit dialog: umbrella-first flow |
| `src/integrations/supabase/hooks/useProducts.ts` | Modify | Include `qb_product_mapping_id` in product CRUD |
| `src/integrations/supabase/hooks/useQBProductMappings.ts` | Modify | Add create/delete mutations |
| `src/components/products/CreateQBUmbrellaDialog.tsx` | Create | Inline dialog for creating new QB umbrellas |
| `supabase/functions/quickbooks-sync-products/index.ts` | Modify | Add `create-qb-product-mapping` action to push new items to QB |

### Backward Compatibility

- Existing products with `qb_product_mapping_id = NULL` continue to work as before
- The `category` string field is kept and auto-populated from the umbrella name, so existing code that reads `product.category` (invoices, estimates, etc.) remains unaffected
- The Item Type enum (product/service/labor) is preserved and auto-derived from the umbrella type when possible
