
## Add Manual Entry Mode to Import Work Order Dialog

### Overview
Add a toggle at the top of the Import Work Order Dialog so users can choose between extracting items from a document or manually entering line items. Both paths lead to the same editing table and job order creation flow.

### UI Changes

**File: `src/components/job-orders/ImportWorkOrderDialog.tsx`**

1. **Add an `entryMode` state** (`"extract"` | `"manual"`) defaulting to `"extract"`.

2. **Add a tab-style toggle** at the top of the dialog body (before the file upload area) using the existing `Tabs` component with two options:
   - "Extract from Document" (FileText icon) -- existing upload flow
   - "Manual Entry" (Plus icon) -- skip upload, go straight to editing

3. **Show customer/project selection immediately** in both modes (move it above the items table, always visible once a mode is selected). Currently it only appears after extraction; in manual mode there's no extraction step.

4. **Manual Entry mode behavior**:
   - Hide the file upload and "Extract" button
   - Show the `ExtractedItemsTable` immediately (empty)
   - Show an "Add Line Item" button below the table that appends a blank item with default values (empty description, qty 1, price 0, unit "EA")

5. **Extract mode** stays exactly as-is (upload file, extract, then edit).

6. **Shared state**: Both modes use the same `extractedItems` state, same editing handlers, same totals calculation, and same "Create Job Order" button.

### Technical Details

**State additions:**
```
entryMode: "extract" | "manual" (default: "extract")
```

**New helper -- `handleAddItem`:**
Generates a new `ExtractedItem` with a unique id (`manual-{timestamp}`), empty description, qty 1, price 0, unit "EA", total 0, and appends it to `extractedItems`.

**Conditional rendering logic:**
- `entryMode === "extract"` and no items yet: show file upload area + process button (existing)
- `entryMode === "manual"` or items exist: show customer/project selectors, items table, "Add Line Item" button, totals, and "Create Job Order" button
- The "Add Line Item" button is shown in both modes once the table is visible

**Reset behavior:**
`resetDialog` also resets `entryMode` to `"extract"`.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/job-orders/ImportWorkOrderDialog.tsx` | Add entry mode toggle, manual entry flow, "Add Line Item" button |

No database or backend changes needed.
