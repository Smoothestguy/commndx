

## Enhance Umbrella-First Product Management: Multi-Add and Umbrella Drill-Down

### Problem
1. The "Add New Item" dialog closes after each product is saved -- you have to reopen it and reselect the umbrella every time
2. There is no way to click on an existing umbrella to view its products or add new items to it
3. The Manage Umbrellas dialog only shows umbrella names and counts -- it does not let you drill into them

### Solution

Transform the Manage Umbrellas dialog into a full umbrella management hub where you can:
- See all umbrellas
- Click into an umbrella to see its products
- Add multiple products to an umbrella in rapid succession
- Keep the "Add & Continue" flow so the form stays open after each save

---

### Change 1: Add "Add Another" / "Add & Continue" to the Add Item Dialog

**File: `src/pages/Products.tsx`**

- Change `handleSubmit` so that instead of always closing the dialog, it has two submit paths:
  - **"Add & Close"** (current behavior) -- saves and closes
  - **"Add & Add Another"** -- saves, clears name/description/cost fields but keeps the umbrella and margin selected, so you can immediately type the next item
- Add a second button "Add & Add Another" next to the existing submit button
- After "Add & Add Another", show a brief success toast and reset only the item-specific fields (name, description, cost, SKU) while preserving umbrella, margin, unit, and taxable settings

### Change 2: Add Drill-Down to Manage Umbrellas Dialog

**File: `src/components/products/ManageUmbrellasDialog.tsx`**

- When you click on an umbrella row (not the delete button), drill into a detail view showing:
  - The umbrella name as a header with a back arrow
  - A list of all products linked to that umbrella (filtered by `qb_product_mapping_id`)
  - An "Add Item" button that opens the Add Item dialog with the umbrella pre-selected
  - Each product row shows name, cost, price, with edit/delete actions
- This turns the dialog into a two-level navigation: umbrella list -> umbrella detail

### Change 3: Pre-Select Umbrella When Adding From Drill-Down

**File: `src/pages/Products.tsx`** and **`src/components/products/ManageUmbrellasDialog.tsx`**

- Add an `onAddItem` callback prop to ManageUmbrellasDialog that passes the selected umbrella ID
- When triggered, the Products page opens the Add Item dialog with that umbrella pre-selected
- Combined with "Add & Add Another", this lets you rapidly add multiple items under one umbrella

---

### Technical Details

**`src/pages/Products.tsx`**

1. Add a `handleSubmitAndContinue` function that saves the product, resets name/description/cost/SKU but keeps umbrella, margin, unit, and taxable
2. Add a second button in the form footer: "Add & Add Another" (only shown when creating, not editing)
3. Add an `openNewDialogWithUmbrella(umbrellaId: string)` function that pre-fills the umbrella selection and opens the dialog
4. Pass `onAddItem={openNewDialogWithUmbrella}` and `onEditItem={handleEdit}` to `ManageUmbrellasDialog`

**`src/components/products/ManageUmbrellasDialog.tsx`**

1. Add `selectedUmbrella` state to track which umbrella is drilled into (null = list view, string = detail view)
2. In detail view, filter products by `qb_product_mapping_id === selectedUmbrella` and display them
3. Add "Add Item" button in detail view that calls `onAddItem(umbrellaId)`
4. Add edit button per product row that calls `onEditItem(product)`
5. Add back button to return to umbrella list
6. New props: `onAddItem?: (umbrellaId: string) => void` and `onEditItem?: (product: Product) => void`

### Files to Modify

| File | Purpose |
|------|---------|
| `src/pages/Products.tsx` | Add "Add & Add Another" button, add `openNewDialogWithUmbrella` function, pass callbacks to ManageUmbrellasDialog |
| `src/components/products/ManageUmbrellasDialog.tsx` | Add drill-down detail view with product list, add item button, edit actions |
