

## Collapsible Line Items in Job Order Edit Form

### Overview
Replace the always-expanded line item cards with a collapsible design. Each item shows a compact summary row (item number, description, total) that expands on click to reveal all editable fields.

### File to Modify
`src/components/job-orders/JobOrderForm.tsx`

### Changes

**1. Add expand/collapse state tracking**
- Add `expandedItems` state as a `Set<string>` to track which line item IDs are expanded
- Add a `toggleExpand(id)` helper function
- Newly added items auto-expand (update `addLineItem` to add the new item's ID to the set)

**2. Import additional icons**
- Add `ChevronDown` and `ChevronRight` from lucide-react for the expand/collapse indicator

**3. Restructure each line item's JSX (lines ~341-531)**

Replace the current flat card layout with a two-part structure:

**Collapsed header row** (always visible, clickable):
```
[ChevronRight/Down] Item 1 — "Wood Floor Labor..." (truncated) ........... $893.75 [Delete]
```
- Clicking the row toggles expand/collapse
- Description truncated to ~40 characters with ellipsis
- Total shown on the right side
- Delete button stays in the header (with stopPropagation so it doesn't toggle)

**Expanded content** (conditionally rendered when item is in `expandedItems`):
- All existing fields: Product selector, Description, Quantity, Unit Price, Margin, Total (read-only)
- Same validation error messages
- Wrapped with a smooth transition (using Collapsible component from `@radix-ui/react-collapsible` already available in the project)

**4. Use the existing Collapsible component**
The project already has `src/components/ui/collapsible.tsx` wrapping `@radix-ui/react-collapsible`. Use `Collapsible`, `CollapsibleTrigger`, and `CollapsibleContent` for the expand/collapse behavior.

### Technical Details

```typescript
// New state
const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

const toggleExpand = (id: string) => {
  setExpandedItems(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
};

// In addLineItem, auto-expand the new item:
setExpandedItems(prev => new Set(prev).add(newItem.id));
```

**Collapsed row structure:**
```
<CollapsibleTrigger className="w-full">
  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/80">
    <div className="flex items-center gap-3 min-w-0">
      <ChevronRight/ChevronDown icon (based on expanded state)
      <span>Item {index + 1}</span>
      <span className="text-muted-foreground truncate max-w-[300px]">
        {item.description || "No description"}
      </span>
    </div>
    <div className="flex items-center gap-3">
      <span className="font-semibold">${item.total.toFixed(2)}</span>
      <Delete button (with e.stopPropagation)>
    </div>
  </div>
</CollapsibleTrigger>
```

**Expanded content** wraps the existing product selector, description, quantity, unit price, margin, and total fields inside `<CollapsibleContent>` with padding.

### Visual Result
- Default view: Clean list of compact rows showing item number, description snippet, and total
- Click to expand: Full editing form slides open below the summary row
- Multiple items can be open at once
- New items open automatically for immediate editing
