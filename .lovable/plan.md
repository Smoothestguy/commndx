

## Inline-Editable Table with Drag-to-Reorder Line Items

### Overview
Make Qty, Price, and Margin directly editable as inline inputs in the table rows (no expand needed), keep the collapsible dropdown only for the product selector and description, and add drag handles to reorder line items.

### Changes to `src/components/job-orders/JobOrderForm.tsx`

**1. Make Qty, Price, Margin inline-editable in the collapsed row**

Replace the read-only text cells for Qty, Price, and Margin (lines 396-398) with small inline `<Input>` elements that users can type into directly without expanding:

- Qty: `<Input type="number" step="0.01" />` styled as `h-7 w-[60px] text-xs text-right bg-transparent border-transparent hover:border-border focus:border-primary`
- Price: Same style, `w-[75px]`
- Margin: Same style, `w-[65px]` with `%` suffix
- Each input calls `updateLineItem()` on change and uses `e.stopPropagation()` to prevent toggling the collapsible
- Total remains read-only text (auto-calculated)

**2. Slim down the collapsible expanded section**

The expanded section (lines 417-586) now only needs:
- Product selector (combobox) -- keep as-is
- Description input -- keep as-is
- Remove the Qty/Price/Margin/Total fields from the expanded section since they're now inline

**3. Add drag handle for reordering**

- Import `GripVertical` from lucide-react
- Add a drag handle column as the first column (before `#`)
- Use HTML5 drag-and-drop (simpler than dnd-kit for this table context):
  - Add `draggable` attribute to each `TableRow`
  - Track `draggedIndex` and `dragOverIndex` in state
  - On `onDragEnd`, reorder the `lineItems` array
  - Visual indicator: highlight the drop target row

**4. Update table header**

Add a narrow drag handle column header (empty, ~30px wide) before `#`.

### Technical Details

**Inline input styling** (borderless until hover/focus):
```tsx
<Input
  type="number"
  value={item.quantity}
  onChange={(e) => updateLineItem(item.id, "quantity", e.target.value)}
  onClick={(e) => e.stopPropagation()}
  className="h-7 w-[60px] text-xs text-right bg-transparent border-transparent hover:border-border focus:border-primary tabular-nums px-1"
/>
```

**Drag reorder state and handlers:**
```typescript
const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

const handleDragStart = (index: number) => setDraggedIndex(index);
const handleDragOver = (e: React.DragEvent, index: number) => {
  e.preventDefault();
  setDragOverIndex(index);
};
const handleDrop = (index: number) => {
  if (draggedIndex === null || draggedIndex === index) return;
  const reordered = [...lineItems];
  const [moved] = reordered.splice(draggedIndex, 1);
  reordered.splice(index, 0, moved);
  setLineItems(reordered);
  setDraggedIndex(null);
  setDragOverIndex(null);
};
```

**Row with drag handle:**
```tsx
<TableRow
  draggable
  onDragStart={() => handleDragStart(index)}
  onDragOver={(e) => handleDragOver(e, index)}
  onDrop={() => handleDrop(index)}
  onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
  className={cn(
    "cursor-pointer text-xs hover:bg-muted/50",
    dragOverIndex === index && "border-t-2 border-primary"
  )}
>
  <TableCell className="py-1.5 px-1 cursor-grab">
    <GripVertical className="h-3 w-3 text-muted-foreground" />
  </TableCell>
  ...
</TableRow>
```

### Result
- Qty, Price, Margin are directly editable in each row -- no expand needed
- Clicking the chevron/description area still expands to show the product selector and description editor
- Drag handle on the left lets users reorder rows by dragging
- Much more efficient workflow for quick edits

