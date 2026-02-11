
## Improve Umbrella/Category Management Workflow

### Overview
Three improvements to how QB umbrella categories are managed and how products are added to line item builders across the app.

---

### 1. Create Umbrella Outside the "Add New Item" Modal

**Current state**: The "Create QB Umbrella" dialog can only be triggered from within the Add/Edit Item modal via the dropdown's "+ Create new umbrella..." option.

**Change**: Add a dedicated "Manage Umbrellas" button on the main Products & Services page toolbar (next to "Add Item"). This opens a management panel/dialog showing all umbrellas with the ability to create new ones.

**Files to modify**:
- `src/pages/Products.tsx` -- Add a "Manage Umbrellas" button in the page actions area that opens a new management dialog

**Files to create**:
- `src/components/products/ManageUmbrellasDialog.tsx` -- A dialog listing all active QB umbrella categories with:
  - A list/table of existing umbrellas (name, type, active status)
  - A "Create New" button at the top
  - Delete buttons on each row (see item 2 below)
  - Inline create form at the top (reuses existing `useCreateQBProductMapping`)

---

### 2. Delete Umbrella Categories

**Current state**: `useDeleteQBProductMapping` exists in the hooks file (soft-deletes by setting `is_active = false`) but there is no UI to trigger it.

**Change**: Add a delete button on each umbrella row in the new Manage Umbrellas dialog.

**Details**:
- Each umbrella row gets a trash icon button
- Clicking it shows a confirmation dialog warning that products linked to this umbrella will keep their data but the umbrella will be deactivated
- Uses the existing `useDeleteQBProductMapping` hook (already does soft-delete)
- Products with `qb_product_mapping_id` pointing to the deleted umbrella will still work -- the FK has `ON DELETE SET NULL` and the umbrella is only soft-deleted anyway

**Files to modify**:
- `src/components/products/ManageUmbrellasDialog.tsx` (new file from item 1) -- Include delete action per row

---

### 3. Bulk Add Products by Umbrella

**Current state**: In the LineItemBuilder and other line item forms (PO, Estimate, Invoice, Vendor Bill), products are added one at a time via a product selector dropdown.

**Change**: Add a "Bulk Add by Category" action in the line item interfaces. When triggered:
1. User selects an umbrella category from a dropdown
2. All products that belong to that umbrella (matching `qb_product_mapping_id`) are fetched
3. All matching products are added as line items in a single batch operation with default quantity of 1

**Implementation approach**:
- Create a reusable `BulkAddByUmbrellaPopover` component that can be dropped into any line item section
- The component shows a button ("Add by Category") that opens a popover/dropdown of umbrella categories
- Selecting one immediately adds all products under that umbrella as new line items
- Optimized: single state update with all new items at once (no individual re-renders)

**Files to create**:
- `src/components/products/BulkAddByUmbrellaPopover.tsx` -- Reusable popover component with umbrella selector and bulk-add logic

**Files to modify**:
- `src/components/ai-assistant/forms/LineItemBuilder.tsx` -- Add the bulk-add button next to the existing "Add Item" button
- `src/components/purchase-orders/PurchaseOrderForm.tsx` -- Add bulk-add button in the line items section
- `src/components/vendor-bills/VendorBillForm.tsx` -- Add bulk-add button in the line items section

For each form, the bulk-add button will:
- Fetch products where `qb_product_mapping_id` matches the selected umbrella
- Map each product to a new line item with pre-filled description, quantity (1), and price/cost
- Append all new line items to the existing list in one state update

---

### Technical Details

**New component: `ManageUmbrellasDialog.tsx`**
- Uses `useQBProductMappings()` to list umbrellas
- Uses `useCreateQBProductMapping()` for inline creation
- Uses `useDeleteQBProductMapping()` for soft-delete with confirmation
- Shows count of products per umbrella (by filtering products data)

**New component: `BulkAddByUmbrellaPopover.tsx`**
- Props: `onAddItems(items: Array<{ product_id, description, quantity, unit_price }>)` callback
- Internally uses `useQBProductMappings()` and `useProducts()` 
- Filters products by `qb_product_mapping_id` matching selected umbrella
- Calls the callback with all matching products in one batch
- Shows a count badge next to each umbrella name (e.g., "Subcontract Labor - Flooring (5 items)")

**Database**: No schema changes needed. All data already exists (`qb_product_service_mappings`, `products.qb_product_mapping_id`).

**Hooks**: No new hooks needed. Existing `useQBProductMappings`, `useCreateQBProductMapping`, `useDeleteQBProductMapping`, and `useProducts` cover all operations.

---

### Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/products/ManageUmbrellasDialog.tsx` | Create | Full umbrella management UI with create + delete |
| `src/components/products/BulkAddByUmbrellaPopover.tsx` | Create | Reusable bulk-add-by-category popover |
| `src/pages/Products.tsx` | Modify | Add "Manage Umbrellas" button to page toolbar |
| `src/components/ai-assistant/forms/LineItemBuilder.tsx` | Modify | Add bulk-add button |
| `src/components/purchase-orders/PurchaseOrderForm.tsx` | Modify | Add bulk-add button in line items section |
| `src/components/vendor-bills/VendorBillForm.tsx` | Modify | Add bulk-add button in line items section |
