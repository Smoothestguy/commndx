

## Batch Item Staging: Review Before Saving

### Problem
Currently, "Add & Add Another" immediately saves each item to the database. You cannot see a running list of what you have added, and there is no way to review or remove items before committing them.

### Solution
Replace the immediate-save behavior with a **staging list** inside the Add Item dialog. Items are accumulated in a local list as you fill them in. You can review, remove, or edit staged items before clicking a single "Save All" button that commits them all at once.

### How It Will Work

1. Open "Add New Item" and select an umbrella category
2. Fill in Name, Cost, etc. and click "Add to List"
3. The item appears in a scrollable staged list at the bottom of the dialog (showing name, cost, price)
4. The form clears (keeping umbrella, margin, unit, taxable) so you can immediately enter the next item
5. Repeat as many times as needed
6. Click "Save All (X items)" to commit everything to the database in one batch
7. Each staged item has an "X" button to remove it before saving
8. "Cancel" discards all unsaved staged items

### Technical Details

**File: `src/pages/Products.tsx`**

1. Add a `stagedItems` state array: `useState<Array<{...formFields, id: string}>>([])`
   - Each staged item gets a temporary `crypto.randomUUID()` for keying
2. Replace `handleSubmitAndContinue` with `handleAddToList`:
   - Instead of calling `addProduct.mutateAsync`, push the computed product data into `stagedItems`
   - Clear item-specific fields (name, description, cost, SKU) but keep umbrella/margin/unit/taxable
   - Show a brief inline confirmation (not a toast, since nothing is saved yet)
3. Add `handleSaveAll`:
   - Loops through `stagedItems` and calls `addProduct.mutateAsync` for each (or batch insert via a single Supabase `.insert()` call for speed)
   - On success: clears `stagedItems`, closes dialog, shows toast "X items added"
   - On error: shows which items failed, keeps them in the list
4. Rename the existing "Add & Add Another" button to "Add to List"
5. Replace "Add [Type]" button with "Save All (X items)" when staged items exist, or keep it as a single-save when no staging is happening
6. Render the staged items list between the form and the action buttons:
   - Compact rows: Name | Cost | Price | Remove button
   - Scrollable area (max-height ~200px)
   - Item count badge
7. On dialog close/cancel: clear `stagedItems`
8. When editing an existing product (editingProduct is set), hide the staging UI entirely -- editing remains single-item as before

**File: `src/integrations/supabase/hooks/useProducts.ts`**

- Add a `useAddProducts` (plural) mutation that does a batch `.insert()` for multiple products at once, invalidating the query cache once. This avoids N separate round-trips.

### UI Layout Inside Dialog (when staging)

```text
+----------------------------------+
| Add New Item                     |
+----------------------------------+
| [Umbrella selector]              |
| [Name] [SKU]                     |
| [Description]                    |
| [Cost] [Margin]                  |
| [Unit] [Taxable toggle]          |
| Calculated Price: $XX.XX         |
+----------------------------------+
| Staged Items (3)                 |
| +------------------------------+|
| | Floor Tile   $45  $64.29  [x]||
| | Grout        $12  $17.14  [x]||
| | Sealant      $8   $11.43  [x]||
| +------------------------------+|
+----------------------------------+
| [Cancel] [Add to List] [Save All]|
+----------------------------------+
```

### Files to Modify

| File | Purpose |
|------|---------|
| `src/pages/Products.tsx` | Add `stagedItems` state, `handleAddToList`, `handleSaveAll`, render staged list, update button labels |
| `src/integrations/supabase/hooks/useProducts.ts` | Add `useAddProducts` batch insert mutation |

