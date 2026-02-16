

## Two-Step "Add by Category" with Item Selection

### Current Behavior
Clicking a category immediately adds **all** items from that category to the bill with no option to choose which ones.

### New Behavior
1. **Step 1 -- Pick a category** (same as today): You see the list of categories with item counts.
2. **Step 2 -- Pick items**: After selecting a category, the popover switches to show all items under that category with **checkboxes**. You can select/deselect individual items. A "Select All" toggle is provided for convenience. Clicking "Add Selected" adds only the checked items.

### UI Flow

```
[Add by Category] button
       |
       v
+---------------------------+
| Select a category         |
|                           |
|  Flooring Materials  (12) |
|  Electrical Supplies  (8) |
|  ...                      |
+---------------------------+
       | click category
       v
+---------------------------+
| < Back    Flooring (12)   |
|                           |
| [x] Select All            |
| _________________________ |
| [x] Item A     $12.00     |
| [x] Item B     $25.00     |
| [ ] Item C     $8.50      |
| [x] Item D     $15.00     |
| ...                       |
| _________________________ |
| [Add 3 Selected]          |
+---------------------------+
```

### Technical Details

**File to modify:** `src/components/products/BulkAddByUmbrellaPopover.tsx`

**Changes:**

1. Add two new state variables:
   - `selectedUmbrellaId: string | null` -- tracks which category was picked (null = step 1)
   - `selectedProductIds: Set<string>` -- tracks which items are checked

2. When a category is clicked, instead of calling `onAddItems` immediately, set `selectedUmbrellaId` to that category's ID and pre-select all items (all checked by default).

3. Render a second view when `selectedUmbrellaId` is set:
   - A "Back" button to return to category list
   - A "Select All / Deselect All" checkbox
   - A scrollable list of items with checkboxes, showing item name and price
   - An "Add Selected (N)" button at the bottom

4. Clicking "Add Selected" filters the matched products to only those in `selectedProductIds`, builds the `BulkLineItem[]` array, calls `onAddItems`, and closes the popover.

5. Reset `selectedUmbrellaId` and `selectedProductIds` when the popover closes.

No other files need to change -- the `onAddItems` callback interface stays the same.

